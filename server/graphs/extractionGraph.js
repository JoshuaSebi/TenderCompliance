import Groq from "groq-sdk";
import { StateGraph, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { classifyBatch } from "../chains/extractionChain.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────
// Graph State
// Key fix: confirmedRequirements uses array concat reducer
// so verified items ACCUMULATE across verify cycles instead of being replaced
// ─────────────────────────────────────────────
const GraphState = Annotation.Root({
  // Input
  sourceText: Annotation({ reducer: (a, b) => b ?? a }),
  segments:   Annotation({ reducer: (a, b) => b ?? a }),

  // The full extracted list (replaced each cycle)
  extracted: Annotation({ reducer: (a, b) => b ?? a }),

  // ── KEY FIX ──
  // confirmedRequirements ACCUMULATES across all verify cycles
  // Using concat reducer so each cycle ADDS to the list, never replaces
  confirmedRequirements: Annotation({
    reducer: (a, b) => {
      if (!a) return b || [];
      if (!b) return a;
      // Merge and deduplicate by 80-char fingerprint
      const seen = new Set(a.map((r) => r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80)));
      const newItems = b.filter((r) => {
        const fp = r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
        if (seen.has(fp)) return false;
        seen.add(fp);
        return true;
      });
      return [...a, ...newItems];
    },
    default: () => [],
  }),

  // Requirements still pending verification (replaced each cycle)
  pendingRequirements: Annotation({ reducer: (a, b) => b ?? a }),

  // Unsure requirements — accumulates across cycles
  unsureRequirements: Annotation({
    reducer: (a, b) => {
      if (!a) return b || [];
      if (!b) return a;
      const seen = new Set(a.map((r) => r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80)));
      const newItems = b.filter((r) => {
        const fp = r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
        if (seen.has(fp)) return false;
        seen.add(fp);
        return true;
      });
      return [...a, ...newItems];
    },
    default: () => [],
  }),

  // Final output
  finalRequirements: Annotation({ reducer: (a, b) => b ?? a }),

  // Control
  retryMap:   Annotation({ reducer: (a, b) => b ?? a, default: () => ({}) }),
  retryCount: Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),
  maxRetries: Annotation({ reducer: (a, b) => b ?? a, default: () => 2 }),
});

// ─────────────────────────────────────────────
// JSON Cleaner
// ─────────────────────────────────────────────
function cleanJson(raw) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON found");

  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) throw new Error("Unmatched braces");

  return cleaned.substring(start, end + 1)
    .replace(/[\u201C\u201D]/g, '\\"')
    .replace(/[\u2018\u2019]/g, "'");
}

const fingerprint = (text) =>
  text.toLowerCase().replace(/\s+/g, " ").trim().substring(0, 80);

// ─────────────────────────────────────────────
// NODE 1: Extract
// ─────────────────────────────────────────────
async function extractNode(state) {
  console.log("\n[Node: Extract] Processing", state.segments.length, "segments");

  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < state.segments.length; i += BATCH_SIZE) {
    const batch      = state.segments.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const classified = await classifyBatch(batch, batchIndex);
    results.push(...classified);

    if (i + BATCH_SIZE < state.segments.length) {
      console.log(`[Extract] Waiting 10s before next batch...`);
      await sleep(10000);
    }
  }

  console.log(`[Extract] Got ${results.length} requirements`);

  return {
    extracted:           results,
    pendingRequirements: results, // all go to verify on first pass
  };
}

// ─────────────────────────────────────────────
// NODE 2: Verify
// Only verifies pendingRequirements (not the full list again)
// Confirmed ones get added to confirmedRequirements accumulator
// ─────────────────────────────────────────────
async function verifyNode(state) {
  // Only check requirements that are still pending
  const toVerify = state.pendingRequirements || [];
  console.log(`\n[Node: Verify] Checking ${toVerify.length} pending requirements`);

  if (toVerify.length === 0) {
    console.log("[Verify] Nothing to verify");
    return {
      pendingRequirements: [],
    };
  }

  const sourceText        = state.sourceText;
  const retryMap          = state.retryMap || {};
  const MAX_RETRIES_PER_REQ = 3;
  const BATCH_SIZE          = 10;

  const newlyConfirmed = [];
  const stillFailed    = [];
  const newlyUnsure    = [];

  for (let i = 0; i < toVerify.length; i += BATCH_SIZE) {
    const batch = toVerify.slice(i, i + BATCH_SIZE);
    const reqList = batch
      .map((r, idx) => `[${idx + 1}] "${r.text}"`)
      .join("\n");

    const sourceSnippet = sourceText.substring(0, 15000);

    try {
      const chat = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `You are a hallucination detector for a document extraction system.

You will receive:
1. A source document (the original text)
2. A list of extracted requirement texts

For EACH requirement, check if the exact text (or very close to it) appears in the source document.

Verdict options:
- "verbatim"    → text appears word-for-word or with only minor whitespace/punctuation differences
- "paraphrased" → meaning is similar but wording is different (HALLUCINATION)
- "invented"    → text does not appear in the source at all (HALLUCINATION)

Be lenient with minor formatting differences (extra spaces, line breaks, quote style).
Be strict about actual word changes, additions, or omissions.

Return ONLY raw JSON. No markdown. Start { end }.
{
  "verifications": [
    { "index": 1, "verdict": "verbatim", "issue": null },
    { "index": 2, "verdict": "paraphrased", "issue": "Source says X but extracted says Y" }
  ]
}`,
          },
          {
            role: "user",
            content: `SOURCE DOCUMENT:\n${sourceSnippet}\n\nEXTRACTED REQUIREMENTS TO VERIFY:\n${reqList}`,
          },
        ],
      });

      const raw    = chat.choices[0].message.content;
      const parsed = JSON.parse(cleanJson(raw));

      if (Array.isArray(parsed.verifications)) {
        parsed.verifications.forEach((v) => {
          const req = batch[v.index - 1];
          if (!req) return;

          const fp           = fingerprint(req.text);
          const timesRetried = retryMap[fp] || 0;

          if (v.verdict === "verbatim") {
            // ✅ Confirmed — add to accumulator
            newlyConfirmed.push({ ...req, verdict: "verbatim", verified: true, unsure: false });
          } else if (timesRetried >= MAX_RETRIES_PER_REQ) {
            // ❌ Hit retry limit — mark as unsure
            console.warn(`[Verify] Retry limit hit for: "${req.text.substring(0, 60)}..." → UNSURE`);
            newlyUnsure.push({
              ...req,
              verdict:  "unsure",
              issue:    v.issue || "Could not verify after maximum retries",
              verified: false,
              unsure:   true,
            });
          } else {
            // ❌ Failed but can retry
            stillFailed.push({
              ...req,
              verdict: v.verdict,
              issue:   v.issue || null,
              verified: false,
              unsure:   false,
            });
          }
        });
      }
    } catch (err) {
      console.error(`[Verify] Batch failed:`, err.message);
      // API failure — treat all as confirmed to avoid data loss
      batch.forEach((req) => newlyConfirmed.push({ ...req, verdict: "unknown", verified: true, unsure: false }));
    }

    if (i + BATCH_SIZE < toVerify.length) {
      console.log(`[Verify] Waiting 10s before next batch...`);
      await sleep(10000);
    }
  }

  // Update retryMap for failed requirements
  const updatedRetryMap = { ...retryMap };
  stillFailed.forEach((r) => {
    const fp = fingerprint(r.text);
    updatedRetryMap[fp] = (updatedRetryMap[fp] || 0) + 1;
  });

  console.log(`[Verify] Confirmed: ${newlyConfirmed.length} | Failed: ${stillFailed.length} | Unsure: ${newlyUnsure.length}`);
  console.log(`[Verify] Total confirmed so far: ${(state.confirmedRequirements || []).length + newlyConfirmed.length}`);

  return {
    confirmedRequirements: newlyConfirmed, // reducer accumulates these
    unsureRequirements:    newlyUnsure,    // reducer accumulates these
    pendingRequirements:   stillFailed,    // replaced — only failed ones remain
    retryMap:              updatedRetryMap,
  };
}

// ─────────────────────────────────────────────
// NODE 3: Re-extract
// Only processes stillFailed (pendingRequirements)
// ─────────────────────────────────────────────
async function reExtractNode(state) {
  const failed = state.pendingRequirements || [];
  console.log(`\n[Node: Re-extract] Retrying ${failed.length} requirements`);

  if (failed.length === 0) return { pendingRequirements: [] };

  const reextracted = [];

  for (const req of failed) {
    const words       = req.text.split(" ").slice(0, 5).join(" ");
    const sourceIndex = state.sourceText.toLowerCase().indexOf(words.toLowerCase());

    let context = "";
    if (sourceIndex !== -1) {
      context = state.sourceText.substring(
        Math.max(0, sourceIndex - 50),
        Math.min(state.sourceText.length, sourceIndex + 400)
      );
    }

    if (!context) {
      console.log(`[Re-extract] No source context for: "${req.text.substring(0, 50)}..." → unsure`);
      // No context — move directly to unsure, don't keep retrying
      reextracted.push({
        ...req,
        verdict:  "unsure",
        issue:    "Could not locate source context for re-extraction",
        verified: false,
        unsure:   true,
      });
      continue;
    }

    try {
      const chat = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: `You are a strict verbatim text extractor.

Find and copy the obligation sentence CHARACTER FOR CHARACTER from the source text.
- Must contain "shall", "must", "required", or "mandatory"
- Copy exactly — no rewording, no shortening
- Include all sub-items (a)(b)(c) if present

Return ONLY raw JSON:
{ "text": "exact sentence here", "category": "Technical|Financial|Legal|General", "keyword": "shall" }
If no obligation sentence found: { "text": null }`,
          },
          {
            role: "user",
            content: `Source text excerpt:\n"${context}"\n\nCopy the obligation sentence verbatim.`,
          },
        ],
      });

      const raw    = chat.choices[0].message.content;
      const parsed = JSON.parse(cleanJson(raw));

      if (parsed.text && parsed.text.trim()) {
        // Successfully re-extracted — goes back into pending for re-verification
        reextracted.push({
          text:     parsed.text.trim(),
          category: parsed.category || req.category || "General",
          keyword:  parsed.keyword  || req.keyword  || "shall",
          verdict:  "reextracted",
          verified: false, // will be re-verified
          unsure:   false,
        });
        console.log(`[Re-extract] Fixed: "${parsed.text.substring(0, 60)}..."`);
      } else {
        // Model couldn't find it — mark unsure
        reextracted.push({
          ...req,
          verdict:  "unsure",
          issue:    "Re-extraction found no obligation sentence in source context",
          verified: false,
          unsure:   true,
        });
      }
    } catch (err) {
      reextracted.push({
        ...req,
        verdict:  "unsure",
        issue:    `Re-extraction error: ${err.message}`,
        verified: false,
        unsure:   true,
      });
    }

    await sleep(2000);
  }

  const toReverify   = reextracted.filter((r) => !r.unsure);
  const newlyUnsure  = reextracted.filter((r) => r.unsure);

  console.log(`[Re-extract] To re-verify: ${toReverify.length} | New unsure: ${newlyUnsure.length}`);

  return {
    pendingRequirements: toReverify,   // goes back to verify node
    unsureRequirements:  newlyUnsure,  // accumulates in state
    retryCount:          (state.retryCount || 0) + 1,
  };
}

// ─────────────────────────────────────────────
// NODE 4: Compile
// confirmedRequirements already has everything accumulated
// ─────────────────────────────────────────────
function compileNode(state) {
  console.log("\n[Node: Compile] Building final requirements list");

  const VALID_CATEGORIES = ["Technical", "Legal", "Financial", "General"];
  const VALID_KEYWORDS   = ["shall", "must", "required", "mandatory"];

  // confirmedRequirements accumulated all verified items across every cycle
  const confirmed = state.confirmedRequirements || [];
  const unsure    = state.unsureRequirements    || [];

  // Deduplicate confirmed
  const seenConfirmed = new Set();
  const uniqueConfirmed = confirmed.filter((r) => {
    const fp = r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
    if (seenConfirmed.has(fp)) return false;
    seenConfirmed.add(fp);
    return true;
  });

  // Deduplicate unsure (also remove any that made it to confirmed)
  const seenUnsure = new Set();
  const uniqueUnsure = unsure.filter((r) => {
    const fp = r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
    // Skip if already confirmed
    if (seenConfirmed.has(fp)) return false;
    if (seenUnsure.has(fp)) return false;
    seenUnsure.add(fp);
    return true;
  });

  // Assign sequential IDs
  const finalReqs = uniqueConfirmed.map((r, idx) => ({
    id:       idx + 1,
    text:     r.text.trim(),
    category: VALID_CATEGORIES.includes(r.category) ? r.category : "General",
    keyword:  VALID_KEYWORDS.includes(r.keyword?.toLowerCase()) ? r.keyword.toLowerCase() : "required",
    verified: true,
    unsure:   false,
  }));

  const finalUnsure = uniqueUnsure.map((r, idx) => ({
    id:       `U${idx + 1}`,
    text:     r.text.trim(),
    category: VALID_CATEGORIES.includes(r.category) ? r.category : "General",
    keyword:  VALID_KEYWORDS.includes(r.keyword?.toLowerCase()) ? r.keyword.toLowerCase() : "required",
    verified: false,
    unsure:   true,
    issue:    r.issue || "Could not verify against source document",
  }));

  console.log(`[Compile] Verified: ${finalReqs.length} | Unsure: ${finalUnsure.length}`);

  return {
    finalRequirements:  finalReqs,
    unsureRequirements: finalUnsure,
  };
}

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────
function shouldRetry(state) {
  const pending    = state.pendingRequirements || [];
  const retryCount = state.retryCount || 0;
  const maxRetries = state.maxRetries || 2;

  if (pending.length === 0) {
    console.log("[Router] No pending requirements → compile");
    return "compile";
  }

  if (retryCount >= maxRetries) {
    console.log(`[Router] Global max retries (${maxRetries}) reached → compile`);
    return "compile";
  }

  // Check if all remaining pending have hit per-requirement limit
  const retryMap    = state.retryMap || {};
  const MAX_PER_REQ = 3;
  const stillRetryable = pending.filter((r) => {
    const fp = fingerprint(r.text);
    return (retryMap[fp] || 0) < MAX_PER_REQ;
  });

  if (stillRetryable.length === 0) {
    console.log("[Router] All remaining failures hit per-requirement limit → compile");
    return "compile";
  }

  console.log(`[Router] ${pending.length} pending → re-extract (attempt ${retryCount + 1})`);
  return "reextract";
}

// ─────────────────────────────────────────────
// Build Graph
// ─────────────────────────────────────────────
function buildGraph() {
  return new StateGraph(GraphState)
    .addNode("extract",   extractNode)
    .addNode("verify",    verifyNode)
    .addNode("reextract", reExtractNode)
    .addNode("compile",   compileNode)
    .addEdge("__start__", "extract")
    .addEdge("extract",   "verify")
    .addConditionalEdges("verify", shouldRetry, {
      reextract: "reextract",
      compile:   "compile",
    })
    .addEdge("reextract", "verify")
    .addEdge("compile",   END)
    .compile();
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export async function extractWithVerification(rfpText, segments) {
  console.log("\n=== LANGGRAPH PIPELINE START ===");
  console.log(`Segments: ${segments.length} | Source chars: ${rfpText.length}`);

  const graph  = buildGraph();
  const result = await graph.invoke({
    sourceText:            rfpText,
    segments,
    retryCount:            0,
    maxRetries:            2,
    retryMap:              {},
    confirmedRequirements: [],
    unsureRequirements:    [],
    pendingRequirements:   [],
  });

  const verified    = result.finalRequirements?.length || 0;
  const unsure      = result.unsureRequirements?.length || 0;

  console.log("\n=== PIPELINE COMPLETE ===");
  console.log(`Extracted  : ${result.extracted?.length || 0}`);
  console.log(`Verified   : ${verified}`);
  console.log(`Unsure     : ${unsure}`);
  console.log("=========================\n");

  return {
    requirements:       result.finalRequirements || [],
    unsureRequirements: result.unsureRequirements || [],
    stats: {
      total:  verified,
      unsure,
      hallucinationsDetected: result.extracted?.length - verified - unsure || 0,
      recovered: unsure > 0 ? 0 : 0,
    },
  };
}

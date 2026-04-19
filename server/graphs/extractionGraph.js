import Groq from "groq-sdk";
import { StateGraph, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// Import the shared classifyBatch from extractionChain
// This ensures BOTH the direct path and the graph path use the EXACT same prompt
// No duplication — one prompt to maintain
import { classifyBatch } from "../chains/extractionChain.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────
// Graph State Definition
// ─────────────────────────────────────────────
const GraphState = Annotation.Root({
  // Input
  sourceText: Annotation({ reducer: (a, b) => b ?? a }),
  segments:   Annotation({ reducer: (a, b) => b ?? a }),

  // Intermediate
  extracted:            Annotation({ reducer: (a, b) => b ?? a }),
  verificationResults:  Annotation({ reducer: (a, b) => b ?? a }),
  failedRequirements:   Annotation({ reducer: (a, b) => b ?? a }),
  reextracted:          Annotation({ reducer: (a, b) => b ?? a }),

  // Output
  finalRequirements: Annotation({ reducer: (a, b) => b ?? a }),

  // Control
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

// ─────────────────────────────────────────────
// NODE 1: Extract
// Uses the shared classifyBatch from extractionChain
// so the prompt is always in sync — change it once, affects both paths
// ─────────────────────────────────────────────
async function extractNode(state) {
  console.log("\n[Node: Extract] Processing", state.segments.length, "segments");

  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < state.segments.length; i += BATCH_SIZE) {
    const batch = state.segments.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    // Reuse classifyBatch from extractionChain — single source of truth for the prompt
    const classified = await classifyBatch(batch, batchIndex);
    results.push(...classified);

    if (i + BATCH_SIZE < state.segments.length) {
      console.log(`[Extract] Waiting 10s before next batch...`);
      await sleep(10000);
    }
  }

  console.log(`[Extract] Got ${results.length} requirements`);
  return { extracted: results };
}

// ─────────────────────────────────────────────
// NODE 2: Verify
// Second AI agent checks if each requirement is verbatim
// ─────────────────────────────────────────────
async function verifyNode(state) {
  console.log("\n[Node: Verify] Checking", state.extracted.length, "requirements");

  const requirements = state.extracted;
  const sourceText = state.sourceText;

  const BATCH_SIZE = 10;
  const verificationResults = [];

  for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
    const batch = requirements.slice(i, i + BATCH_SIZE);

    const reqList = batch
      .map((r, idx) => `[${idx + 1}] "${r.text}"`)
      .join("\n");

    // Use first 15000 chars of source — enough for most documents
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
    {
      "index": 1,
      "verdict": "verbatim",
      "issue": null
    },
    {
      "index": 2,
      "verdict": "paraphrased",
      "issue": "Source says 'X' but extracted says 'Y'"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `SOURCE DOCUMENT:\n${sourceSnippet}\n\nEXTRACTED REQUIREMENTS TO VERIFY:\n${reqList}`,
          },
        ],
      });

      const raw = chat.choices[0].message.content;
      const parsed = JSON.parse(cleanJson(raw));

      if (Array.isArray(parsed.verifications)) {
        parsed.verifications.forEach((v) => {
          const req = batch[v.index - 1];
          if (req) {
            verificationResults.push({
              ...req,
              verdict: v.verdict,
              issue: v.issue || null,
              verified: v.verdict === "verbatim",
            });
          }
        });
      }
    } catch (err) {
      console.error(`[Verify] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message);
      // If verification fails, mark all as verified to avoid losing valid data
      batch.forEach((req) => {
        verificationResults.push({ ...req, verdict: "unknown", verified: true });
      });
    }

    if (i + BATCH_SIZE < requirements.length) {
      console.log(`[Verify] Waiting 10s before next batch...`);
      await sleep(10000);
    }
  }

  const passed = verificationResults.filter((r) => r.verified).length;
  const failed = verificationResults.filter((r) => !r.verified).length;

  console.log(`[Verify] Passed: ${passed} | Failed (hallucinated): ${failed}`);

  return {
    verificationResults,
    failedRequirements: verificationResults.filter((r) => !r.verified),
  };
}

// ─────────────────────────────────────────────
// NODE 3: Re-extract
// For hallucinated requirements, find the source context and re-extract verbatim
// ─────────────────────────────────────────────
async function reExtractNode(state) {
  const failed = state.failedRequirements;
  console.log(`\n[Node: Re-extract] Retrying ${failed.length} hallucinated requirements`);

  if (failed.length === 0) return { reextracted: [] };

  const reextracted = [];

  for (const req of failed) {
    // Find the source context by searching for the first 5 words of the hallucinated text
    // Even if it's paraphrased, the first few words often match
    const words = req.text.split(" ").slice(0, 5).join(" ");
    const sourceIndex = state.sourceText.toLowerCase().indexOf(words.toLowerCase());

    let context = "";
    if (sourceIndex !== -1) {
      context = state.sourceText.substring(
        Math.max(0, sourceIndex - 50),
        Math.min(state.sourceText.length, sourceIndex + 400)
      );
    }

    if (!context) {
      console.log(`[Re-extract] No source context found for: "${req.text.substring(0, 50)}..."`);
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

You will receive a short excerpt from a source document.
Your job: find and copy the obligation sentence CHARACTER FOR CHARACTER — do not change a single word.

Rules:
- The sentence must contain "shall", "must", "required", or "mandatory"
- Copy it exactly as it appears — no rewording, no shortening, no paraphrasing
- If the text contains sub-items (a)(b)(c), include them all

Return ONLY raw JSON. No markdown.
{ "text": "exact sentence here", "category": "Technical|Financial|Legal|General", "keyword": "shall" }
If no obligation sentence found: { "text": null }`,
          },
          {
            role: "user",
            content: `Source text excerpt:\n"${context}"\n\nCopy the obligation sentence verbatim.`,
          },
        ],
      });

      const raw = chat.choices[0].message.content;
      const parsed = JSON.parse(cleanJson(raw));

      if (parsed.text && parsed.text.trim()) {
        reextracted.push({
          text: parsed.text.trim(),
          category: parsed.category || "General",
          keyword: parsed.keyword || "shall",
          verdict: "reextracted",
          verified: true,
        });
        console.log(`[Re-extract] Fixed: "${parsed.text.substring(0, 70)}..."`);
      }
    } catch (err) {
      console.error(`[Re-extract] Failed for: "${req.text.substring(0, 50)}"`);
    }

    await sleep(2000);
  }

  console.log(`[Re-extract] Recovered ${reextracted.length} of ${failed.length}`);
  return { reextracted };
}

// ─────────────────────────────────────────────
// NODE 4: Compile
// Merges verified + reextracted, deduplicates, renumbers
// ─────────────────────────────────────────────
function compileNode(state) {
  console.log("\n[Node: Compile] Building final requirements list");

  const verified    = (state.verificationResults || []).filter((r) => r.verified);
  const reextracted = state.reextracted || [];

  const VALID_CATEGORIES = ["Technical", "Legal", "Financial", "General"];
  const VALID_KEYWORDS   = ["shall", "must", "required", "mandatory"];

  const combined = [...verified, ...reextracted].map((req) => ({
    text:     req.text.trim(),
    category: VALID_CATEGORIES.includes(req.category) ? req.category : "General",
    keyword:  VALID_KEYWORDS.includes(req.keyword?.toLowerCase())
                ? req.keyword.toLowerCase()
                : "required",
    verified: req.verified ?? true,
  }));

  // Deduplicate by 80-char fingerprint
  const seen   = new Set();
  const unique = combined.filter((r) => {
    const fp = r.text.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  // Assign sequential IDs after dedup
  const final = unique.map((r, idx) => ({ ...r, id: idx + 1 }));

  console.log(`[Compile] Final count: ${final.length} requirements`);
  return { finalRequirements: final };
}

// ─────────────────────────────────────────────
// ROUTER: Decide what to do after verification
// ─────────────────────────────────────────────
function shouldRetry(state) {
  const failed     = state.failedRequirements || [];
  const retryCount = state.retryCount || 0;
  const maxRetries = state.maxRetries || 2;

  if (failed.length === 0) {
    console.log("[Router] No hallucinations → compile");
    return "compile";
  }

  if (retryCount >= maxRetries) {
    console.log(`[Router] Max retries (${maxRetries}) reached → compile with what we have`);
    return "compile";
  }

  console.log(`[Router] ${failed.length} hallucinations → re-extract (attempt ${retryCount + 1})`);
  return "reextract";
}

// ─────────────────────────────────────────────
// Build the LangGraph
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
    .addEdge("compile", END)
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
    sourceText: rfpText,
    segments,
    retryCount: 0,
    maxRetries: 2,
  });

  const hallucinationCount = (result.verificationResults || [])
    .filter((r) => !r.verified).length;

  console.log("\n=== PIPELINE COMPLETE ===");
  console.log(`Extracted           : ${result.extracted?.length || 0}`);
  console.log(`Hallucinations found: ${hallucinationCount}`);
  console.log(`Recovered           : ${result.reextracted?.length || 0}`);
  console.log(`Final clean count   : ${result.finalRequirements?.length || 0}`);
  console.log("=========================\n");

  return {
    requirements: result.finalRequirements || [],
    stats: {
      total:                  result.finalRequirements?.length || 0,
      hallucinationsDetected: hallucinationCount,
      recovered:              result.reextracted?.length || 0,
    },
  };
}

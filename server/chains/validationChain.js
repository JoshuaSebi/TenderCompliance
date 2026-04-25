import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  temperature: 0,
  maxTokens: 8000,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────
// JSON Cleaner
// ─────────────────────────────────────────────
function cleanJsonResponse(raw) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");

  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) throw new Error("Malformed JSON: unmatched braces");

  return cleaned.substring(start, end + 1)
    .replace(/[\u201C\u201D]/g, '\\"')
    .replace(/[\u2018\u2019]/g, "'");
}

// ─────────────────────────────────────────────
// Split proposal into overlapping windows
// Each window is sent with every batch of requirements
// This ensures no part of the proposal is missed
// ─────────────────────────────────────────────
function splitProposal(text, windowSize = 6000, overlap = 500) {
  const windows = [];
  let start = 0;

  while (start < text.length) {
    windows.push(text.slice(start, start + windowSize));
    if (start + windowSize >= text.length) break;
    start += windowSize - overlap;
  }

  return windows;
}

// ─────────────────────────────────────────────
// LangChain validation chain
// ─────────────────────────────────────────────
const validationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a procurement compliance expert comparing RFP requirements against a vendor proposal.

For EACH requirement, check if the vendor proposal addresses it — even partially.

STATUS OPTIONS:
- "Met"     → vendor explicitly and fully addresses this with clear, committed language
- "Partial" → vendor partially addresses it, uses vague language, or only covers part
- "Missing" → vendor does not address this at all in the provided text

IMPORTANT: This may be a PARTIAL view of the proposal. If a requirement is not found here,
it may be addressed in another part. Only mark "Missing" if you are highly confident
the proposal does not cover this requirement anywhere.

FIELDS TO RETURN FOR EACH:
- requirementId: the ID number
- status: "Met" | "Partial" | "Missing"
- matchedPassage: EXACT verbatim sentence from the proposal, or null if Missing
- confidenceScore: 0–100
    90–100 → very clear match or clear absence
    60–89  → reasonable but some ambiguity
    0–59   → uncertain
- notes: brief reason for your assessment (1 sentence)

RULES:
- Only use text from the provided proposal — do not infer or assume
- Vague language ("best effort", "where possible") → "Partial"
- Return a result for EVERY requirement

Return ONLY raw JSON. No markdown. Start {{ end }}.
{{
  "validationResults": [
    {{
      "requirementId": 1,
      "status": "Met",
      "matchedPassage": "verbatim text or null",
      "confidenceScore": 90,
      "notes": "brief reason"
    }}
  ]
}}`,
  ],
  [
    "human",
    `REQUIREMENTS TO CHECK ({count} total):
{requirements}

VENDOR PROPOSAL (section {window} of {totalWindows}):
{proposal}`,
  ],
]);

const validationChain = RunnableSequence.from([
  validationPrompt,
  model,
  new StringOutputParser(),
]);

// ─────────────────────────────────────────────
// Validate one batch of requirements against one proposal window
// ─────────────────────────────────────────────
async function validateBatchWindow(
  requirements,
  proposalWindow,
  windowIndex,
  totalWindows,
  batchIndex,
  retries = 3
) {
  const reqText = requirements
    .map((r) => `[ID:${r.id}] [${r.category}] ${r.text}`)
    .join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = await validationChain.invoke({
        count:        requirements.length,
        requirements: reqText,
        proposal:     proposalWindow,
        window:       windowIndex + 1,
        totalWindows,
      });

      console.log(`[Validation] Batch ${batchIndex + 1} Window ${windowIndex + 1}/${totalWindows} length: ${raw.length}`);

      const cleaned = cleanJsonResponse(raw);
      const parsed  = JSON.parse(cleaned);

      if (!parsed.validationResults || !Array.isArray(parsed.validationResults)) return [];

      return parsed.validationResults.filter((r) => r.requirementId !== undefined);

    } catch (err) {
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 5000;
        console.warn(`[Validation] Rate limited. Waiting ${waitMs}ms (retry ${attempt}/${retries})...`);
        await sleep(waitMs);
        continue;
      }

      if (err.status === 400 && err.message?.includes("decommissioned")) {
        throw err;
      }

      console.error(`[Validation] Batch ${batchIndex + 1} Window ${windowIndex + 1} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === retries) return [];
      await sleep(1000 * attempt);
    }
  }

  return [];
}

// ─────────────────────────────────────────────
// Merge results across windows
// Best result per requirement wins:
//   Met > Partial > Missing
// Higher confidence breaks ties
// ─────────────────────────────────────────────
function mergeWindowResults(allWindowResults, requirements) {
  const STATUS_RANK = { Met: 3, Partial: 2, Missing: 1 };

  // Group all results by requirementId
  const byId = {};
  for (const result of allWindowResults) {
    const id = result.requirementId;
    if (!byId[id]) byId[id] = [];
    byId[id].push(result);
  }

  // For each requirement, pick the best result across all windows
  const merged = requirements.map((req) => {
    const results = byId[req.id] || [];

    if (results.length === 0) {
      return {
        requirementId:   req.id,
        requirement:     req.text,
        status:          "Missing",
        matchedPassage:  null,
        confidenceScore: 0,
        category:        req.category,
        notes:           "Not found in any section of the proposal",
      };
    }

    // Pick best: highest status rank, then highest confidence
    const best = results.reduce((a, b) => {
      const rankA = STATUS_RANK[a.status] || 0;
      const rankB = STATUS_RANK[b.status] || 0;
      if (rankA !== rankB) return rankA > rankB ? a : b;
      return (a.confidenceScore || 0) >= (b.confidenceScore || 0) ? a : b;
    });

    return {
      requirementId:   req.id,
      requirement:     req.text,
      status:          best.status,
      matchedPassage:  best.matchedPassage?.trim() || null,
      confidenceScore: best.confidenceScore || 50,
      category:        req.category,
      notes:           best.notes || "",
    };
  });

  return merged;
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export async function validateRequirements(requirements, proposalText) {
  try {
    if (!requirements || requirements.length === 0) {
      throw new Error("No requirements provided for validation");
    }
    if (!proposalText || proposalText.trim().length < 50) {
      throw new Error("Vendor proposal text is empty or too short");
    }

    console.log(`\n[Validation] Validating ${requirements.length} requirements`);
    console.log(`[Validation] Proposal length: ${proposalText.length} chars`);

    // Split proposal into overlapping windows so full document is covered
    const proposalWindows = splitProposal(proposalText, 6000, 500);
    console.log(`[Validation] Proposal split into ${proposalWindows.length} window(s)`);

    // Split requirements into small batches
    const BATCH_SIZE = 5;
    const batches    = [];
    for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
      batches.push(requirements.slice(i, i + BATCH_SIZE));
    }

    console.log(`[Validation] ${requirements.length} requirements → ${batches.length} batch(es) × ${proposalWindows.length} window(s) = ${batches.length * proposalWindows.length} total calls`);

    // Collect ALL results across all batches and windows
    const allWindowResults = [];

    for (let b = 0; b < batches.length; b++) {
      for (let w = 0; w < proposalWindows.length; w++) {
        console.log(`[Validation] Batch ${b + 1}/${batches.length} × Window ${w + 1}/${proposalWindows.length}...`);

        const results = await validateBatchWindow(
          batches[b],
          proposalWindows[w],
          w,
          proposalWindows.length,
          b
        );

        allWindowResults.push(...results);

        // Rate limit delay between calls
        const isLastCall = b === batches.length - 1 && w === proposalWindows.length - 1;
        if (!isLastCall) {
          await sleep(10000);
        }
      }
    }

    console.log(`[Validation] Total raw results: ${allWindowResults.length}`);

    // Merge: best result per requirement across all windows
    const merged = mergeWindowResults(allWindowResults, requirements);

    // Normalize
    const normalized = merged.map((r) => ({
      requirementId:   r.requirementId,
      requirement:     r.requirement?.trim() || "",
      status:          ["Met", "Partial", "Missing"].includes(r.status) ? r.status : "Missing",
      matchedPassage:  r.matchedPassage?.trim() || null,
      confidenceScore: typeof r.confidenceScore === "number"
                         ? Math.min(100, Math.max(0, r.confidenceScore))
                         : 50,
      category:        r.category?.trim() || "General",
      notes:           r.notes || "",
    }));

    // Scores
    const total        = normalized.length;
    const metCount     = normalized.filter((r) => r.status === "Met").length;
    const partialCount = normalized.filter((r) => r.status === "Partial").length;
    const missingCount = total - metCount - partialCount;
    const score        = total > 0
      ? Math.round(((metCount + partialCount * 0.5) / total) * 100)
      : 0;

    // Category breakdown
    const byCategory = normalized.reduce((acc, r) => {
      const cat = r.category || "General";
      if (!acc[cat]) acc[cat] = { met: 0, partial: 0, missing: 0 };
      acc[cat][r.status.toLowerCase()]++;
      return acc;
    }, {});

    console.log(`[Validation] Score: ${score}% | Met: ${metCount} | Partial: ${partialCount} | Missing: ${missingCount}`);

    return {
      score,
      total,
      met:        metCount,
      partial:    partialCount,
      missing:    missingCount,
      byCategory,
      results:    normalized,
    };

  } catch (err) {
    console.error("Validation chain error:", err.message);
    throw new Error(`Failed to validate requirements: ${err.message}`);
  }
}
 
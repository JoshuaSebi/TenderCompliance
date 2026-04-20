import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
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

  let depth = 0;
  let end = -1;
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
// Validate one batch of requirements against proposal
// ─────────────────────────────────────────────
async function validateBatch(requirements, proposalText, batchIndex, retries = 3) {
  const reqText = requirements
    .map((r) => `[ID:${r.id}] [${r.category}] ${r.text}`)
    .join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const chat = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 8000,
        messages: [
          {
            role: "system",
            content: `You are a procurement compliance expert. You will receive a list of RFP requirements and a vendor proposal.

For EACH requirement in the list, carefully read the vendor proposal and determine compliance status.

STATUS OPTIONS:
- "Met"     → vendor explicitly and fully addresses this requirement with clear, committed language
- "Partial" → vendor partially addresses it, uses vague/non-committal language, or only covers part of the requirement
- "Missing" → vendor does not address this requirement at all

FIELDS TO RETURN FOR EACH:
- requirementId: the ID number from the requirement
- requirement: copy the requirement text exactly as provided
- status: "Met" | "Partial" | "Missing"
- matchedPassage: copy the EXACT sentence or passage from the vendor proposal that addresses this requirement.
                  If status is Missing, use null.
                  Must be verbatim from the proposal — do not paraphrase.
- confidenceScore: integer 0–100
    90–100 → very clear match or very clear absence
    60–89  → reasonable assessment but some ambiguity
    0–59   → uncertain due to vague language in proposal
- category: copy the category from the requirement

ASSESSMENT RULES:
- Base your assessment ONLY on the provided vendor proposal text
- Do NOT assume or infer things the proposal does not explicitly state
- Vague language ("best effort", "where possible", "endeavour to") → "Partial" not "Met"
- Proposal is silent on requirement → "Missing"
- Proposal explicitly contradicts requirement → "Missing"
- IMPORTANT: You MUST return a result for EVERY requirement in the list — do not skip any

Return ONLY raw JSON. No markdown. No fences. Start { end }.

{
  "validationResults": [
    {
      "requirementId": 1,
      "requirement": "exact requirement text",
      "status": "Met",
      "matchedPassage": "exact verbatim excerpt from vendor proposal, or null",
      "confidenceScore": 90,
      "category": "Technical"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Validate the vendor proposal against EVERY requirement below. Return a result for each one.

REQUIREMENTS (${requirements.length} total):
${reqText}

VENDOR PROPOSAL:
${proposalText.slice(0, 8000)}`,
          },
        ],
      });

      const raw = chat.choices[0].message.content;
      console.log(`[Validation] Batch ${batchIndex + 1} length: ${raw.length} | finish: ${chat.choices[0].finish_reason}`);

      if (chat.choices[0].finish_reason === "length") {
        console.warn(`[Validation] Batch ${batchIndex + 1} response truncated — reduce BATCH_SIZE`);
      }

      const cleaned = cleanJsonResponse(raw);
      const parsed  = JSON.parse(cleaned);

      if (!parsed.validationResults || !Array.isArray(parsed.validationResults)) return [];

      const results = parsed.validationResults.filter((r) => r.requirementId !== undefined);

      // Warn if model skipped any requirements
      if (results.length < requirements.length) {
        console.warn(`[Validation] Batch ${batchIndex + 1}: expected ${requirements.length} results, got ${results.length}`);
      }

      return results;

    } catch (err) {
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 5000;
        console.warn(`[Validation] Batch ${batchIndex + 1} rate limited. Waiting ${waitMs}ms (retry ${attempt}/${retries})...`);
        await sleep(waitMs);
        continue;
      }

      if (err.status === 400 && err.message?.includes("decommissioned")) {
        console.error("Model decommissioned. Update MODEL in validationChain.js");
        throw err;
      }

      console.error(`[Validation] Batch ${batchIndex + 1} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === retries) {
        // On permanent failure, return Missing for all requirements in this batch
        // so they don't silently disappear from the results
        console.error(`[Validation] Batch ${batchIndex + 1} permanently failed — marking all as Missing`);
        return requirements.map((r) => ({
          requirementId:  r.id,
          requirement:    r.text,
          status:         "Missing",
          matchedPassage: null,
          confidenceScore: 0,
          category:       r.category,
        }));
      }
      await sleep(1000 * attempt);
    }
  }

  return [];
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

    // Batch size of 5 keeps token usage low and avoids rate limits
    // Each batch: ~5 requirements × ~100 tokens each + proposal = ~1500 tokens
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
      batches.push(requirements.slice(i, i + BATCH_SIZE));
    }

    console.log(`[Validation] ${requirements.length} requirements → ${batches.length} batch(es) of ${BATCH_SIZE}`);

    // Process batches sequentially with delay
    const allResults = [];
    for (let i = 0; i < batches.length; i++) {
      console.log(`[Validation] Processing batch ${i + 1}/${batches.length}...`);
      const results = await validateBatch(batches[i], proposalText, i);
      allResults.push(...results);

      if (i < batches.length - 1) {
        console.log(`[Validation] Waiting 10s before batch ${i + 2}...`);
        await sleep(10000);
      }
    }

    console.log(`[Validation] Total results collected: ${allResults.length} of ${requirements.length} expected`);

    // Normalize all results
    const normalized = allResults.map((r) => ({
      requirementId:   r.requirementId,
      requirement:     r.requirement?.trim() || "",
      status:          ["Met", "Partial", "Missing"].includes(r.status) ? r.status : "Missing",
      matchedPassage:  r.matchedPassage?.trim() || null,
      confidenceScore: typeof r.confidenceScore === "number"
                         ? Math.min(100, Math.max(0, r.confidenceScore))
                         : 50,
      category:        r.category?.trim() || "General",
    }));

    // Fill in any requirements the model silently skipped
    // This guarantees the frontend always shows all requirements
    const returnedIds = new Set(normalized.map((r) => r.requirementId));
    const skipped = requirements.filter((r) => !returnedIds.has(r.id));

    if (skipped.length > 0) {
      console.warn(`[Validation] ${skipped.length} requirements were silently skipped by model — marking as Missing`);
      skipped.forEach((r) => {
        normalized.push({
          requirementId:   r.id,
          requirement:     r.text,
          status:          "Missing",
          matchedPassage:  null,
          confidenceScore: 0,
          category:        r.category || "General",
        });
      });
    }

    // Calculate compliance score
    const total        = normalized.length;
    const metCount     = normalized.filter((r) => r.status === "Met").length;
    const partialCount = normalized.filter((r) => r.status === "Partial").length;
    const missingCount = total - metCount - partialCount;

    const score = total > 0
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

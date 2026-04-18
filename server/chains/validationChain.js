import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

// ─────────────────────────────────────────────
// JSON Cleaner — handles fences, think tags, bracket mismatch
// ─────────────────────────────────────────────
function cleanJsonResponse(raw) {
  // 1. Strip <think>...</think> blocks (Qwen3, DeepSeek, etc.)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip markdown code fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  // 3. Bracket counter to find outermost { }
  //    lastIndexOf("}") breaks on nested objects — never use it
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");

  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) throw new Error("Malformed JSON: unmatched braces");

  return cleaned.substring(start, end + 1);
}

// ─────────────────────────────────────────────
// 🔹 Validate Vendor Proposal against RFP Requirements
// ─────────────────────────────────────────────
export async function validateRequirements(requirements, proposalText) {
  try {
    // Format requirements list for the prompt
    const reqText = requirements
      .map((r) => `[ID:${r.id}] [${r.category}] ${r.text}`)
      .join("\n");

    const chat = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0, // zero creativity — deterministic compliance checking
      messages: [
        {
          role: "system",
          content: `You are a procurement compliance expert. You will receive a list of RFP requirements and a vendor proposal.

For EACH requirement in the list, carefully read the vendor proposal and determine:

- status:
    "Met"     → vendor explicitly and fully addresses this requirement
    "Partial" → vendor partially addresses it, or uses vague/non-committal language
    "Missing" → vendor does not address it at all

- matchedPassage: copy the EXACT sentence or passage from the vendor proposal that addresses this requirement. If Missing, use null.

- confidenceScore: integer 0–100 indicating how confident you are in your assessment.
    90–100 → very clear match or very clear absence
    60–89  → reasonable match but some ambiguity
    0–59   → uncertain, vague language in proposal

RULES:
- Base your assessment ONLY on the provided vendor proposal text
- Do NOT assume or infer things the proposal does not explicitly state
- If the proposal is vague or non-committal, mark as "Partial" not "Met"
- matchedPassage must be copied verbatim from the proposal, not paraphrased

Return ONLY a raw JSON object. No markdown. No code fences. No explanation. No text before or after.
Start your response with { and end with }.

JSON structure:
{
  "validationResults": [
    {
      "requirementId": 1,
      "requirement": "original requirement text",
      "status": "Met",
      "matchedPassage": "exact verbatim excerpt from vendor proposal, or null",
      "confidenceScore": 85,
      "category": "Technical"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Validate the vendor proposal against each RFP requirement below.

REQUIREMENTS:
${reqText}

VENDOR PROPOSAL:
${proposalText.slice(0, 8000)}`,
        },
      ],
    });

    const raw = chat.choices[0].message.content;

    // Debug — remove in production
    console.log("Raw validation response (first 500):", raw.substring(0, 500));

    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    if (!parsed.validationResults || !Array.isArray(parsed.validationResults)) {
      throw new Error("Response missing validationResults array");
    }

    // Normalize and validate each result
    parsed.validationResults = parsed.validationResults
      .filter((r) => r.requirementId !== undefined)
      .map((r) => ({
        requirementId: r.requirementId,
        requirement: r.requirement?.trim() || "",
        status: ["Met", "Partial", "Missing"].includes(r.status)
          ? r.status
          : "Missing",
        matchedPassage: r.matchedPassage?.trim() || null,
        confidenceScore: typeof r.confidenceScore === "number"
          ? Math.min(100, Math.max(0, r.confidenceScore))
          : 50,
        category: r.category?.trim() || "General",
      }));

    // Calculate overall compliance score
    // Met = full point, Partial = half point, Missing = 0
    const total = parsed.validationResults.length;
    const metCount = parsed.validationResults.filter(
      (r) => r.status === "Met"
    ).length;
    const partialCount = parsed.validationResults.filter(
      (r) => r.status === "Partial"
    ).length;
    const missingCount = total - metCount - partialCount;

    const score =
      total > 0
        ? Math.round(((metCount + partialCount * 0.5) / total) * 100)
        : 0;

    return {
      score,
      total,
      met: metCount,
      partial: partialCount,
      missing: missingCount,
      results: parsed.validationResults,
    };
  } catch (err) {
    console.error("Validation chain error:", err.message);
    throw new Error(`Failed to validate requirements: ${err.message}`);
  }
}
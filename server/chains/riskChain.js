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
// 🔹 Analyze Vendor Proposal for Risk Red Flags
// ─────────────────────────────────────────────
export async function analyzeRisks(proposalText) {
  try {
    const chat = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0, // deterministic — risk detection must be consistent
      messages: [
        {
          role: "system",
          content: `You are a legal risk analyst specializing in vendor proposals and contracts.

Scan the vendor proposal for red-flag phrases, risky language, or concerning terms.

Look specifically for:
- Vague commitments: "best effort", "where possible", "may", "subject to", "as applicable"
- Liability limitations: "limited liability", "not liable", "no responsibility"
- Unclear or missing timelines: no specific dates, "to be determined", "as agreed"
- Missing guarantees: no SLA, no penalty clause, no performance bond
- Clauses that favour the vendor: unilateral termination rights, price change rights
- Non-compliance signals: contradictions with RFP terms, omissions of mandatory requirements
- Hidden cost traps: "additional fees may apply", "subject to change", "extra charges"

For each red flag:
- sentence: copy the EXACT sentence from the proposal word for word — do not paraphrase
- riskLevel: "High" (could cause legal/financial damage), "Medium" (ambiguous, needs clarification), "Low" (minor concern)
- explanation: brief explanation of why this is a risk to the buyer

RULES:
- Only flag sentences that are actually in the provided proposal text
- Do NOT invent or fabricate red flags
- If no red flags exist, return an empty array

Return ONLY a raw JSON object. No markdown. No code fences. No explanation. No text before or after.
Start your response with { and end with }.

JSON structure:
{
  "redFlags": [
    {
      "sentence": "exact verbatim sentence from the proposal",
      "riskLevel": "High",
      "explanation": "why this is a risk to the buyer"
    }
  ]
}

If no red flags found:
{
  "redFlags": []
}`,
        },
        {
          role: "user",
          content: `Scan the following vendor proposal for risk red flags. Copy flagged sentences VERBATIM.

Vendor Proposal:
${proposalText.slice(0, 8000)}`,
        },
      ],
    });

    const raw = chat.choices[0].message.content;

    // Debug — remove in production
    console.log("Raw risk response (first 500):", raw.substring(0, 500));

    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    if (!parsed.redFlags || !Array.isArray(parsed.redFlags)) {
      return { redFlags: [] };
    }

    // Normalize and validate each flag
    parsed.redFlags = parsed.redFlags
      .filter((flag) => flag.sentence && flag.sentence.trim().length > 0)
      .map((flag) => ({
        sentence: flag.sentence.trim(),
        riskLevel: ["Low", "Medium", "High"].includes(flag.riskLevel)
          ? flag.riskLevel
          : "Medium",
        explanation: flag.explanation?.trim() || "No explanation provided",
      }));

    // Sort by risk level: High → Medium → Low
    const riskOrder = { High: 0, Medium: 1, Low: 2 };
    parsed.redFlags.sort(
      (a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
    );

    // Summary counts
    const high = parsed.redFlags.filter((f) => f.riskLevel === "High").length;
    const medium = parsed.redFlags.filter(
      (f) => f.riskLevel === "Medium"
    ).length;
    const low = parsed.redFlags.filter((f) => f.riskLevel === "Low").length;

    return {
      redFlags: parsed.redFlags,
      summary: {
        total: parsed.redFlags.length,
        high,
        medium,
        low,
      },
    };
  } catch (err) {
    console.error("Risk chain error:", err.message);
    // Don't throw — return empty so validation still works even if risk scan fails
    return {
      redFlags: [],
      summary: { total: 0, high: 0, medium: 0, low: 0 },
    };
  }
}
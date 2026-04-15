import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3-32b",
  temperature: 0.2,
});

const validationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a procurement compliance expert. You will receive a list of RFP requirements and a vendor proposal.

For EACH requirement, analyze the vendor proposal and determine:
- status: "Met" (fully addressed), "Partial" (partially addressed), or "Missing" (not addressed at all)
- matchedPassage: the relevant excerpt from the proposal that addresses this requirement, or null if Missing
- confidenceScore: integer from 0 to 100 indicating how confident you are in your assessment

Return ONLY valid JSON with this exact structure, no markdown fences:
{{
  "validationResults": [
    {{
      "requirementId": 1,
      "requirement": "original requirement text",
      "status": "Met",
      "matchedPassage": "relevant excerpt from proposal",
      "confidenceScore": 85,
      "category": "Technical"
    }}
  ]
}}`,
  ],
  [
    "human",
    `REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposalText}`,
  ],
]);

const outputParser = new StringOutputParser();

const chain = RunnableSequence.from([validationPrompt, model, outputParser]);

function cleanJsonResponse(raw) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No valid JSON found in response");
  }

  return cleaned.substring(jsonStart, jsonEnd + 1);
}

export async function validateRequirements(requirements, proposalText) {
  try {
    const reqText = requirements
      .map((r) => `[ID:${r.id}] [${r.category}] ${r.text}`)
      .join("\n");

    const raw = await chain.invoke({
      requirements: reqText,
      proposalText: proposalText.slice(0, 8000),
    });

    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    if (
      !parsed.validationResults ||
      !Array.isArray(parsed.validationResults)
    ) {
      throw new Error("Response missing validationResults array");
    }

    // Normalize results
    parsed.validationResults = parsed.validationResults.map((r) => ({
      requirementId: r.requirementId,
      requirement: r.requirement || "",
      status: ["Met", "Partial", "Missing"].includes(r.status)
        ? r.status
        : "Missing",
      matchedPassage: r.matchedPassage || null,
      confidenceScore: Math.min(100, Math.max(0, r.confidenceScore || 0)),
      category: r.category || "Technical",
    }));

    // Calculate overall score
    const total = parsed.validationResults.length;
    const metCount = parsed.validationResults.filter(
      (r) => r.status === "Met"
    ).length;
    const partialCount = parsed.validationResults.filter(
      (r) => r.status === "Partial"
    ).length;
    const score =
      total > 0 ? Math.round(((metCount + partialCount * 0.5) / total) * 100) : 0;

    return {
      score,
      total,
      met: metCount,
      partial: partialCount,
      missing: total - metCount - partialCount,
      results: parsed.validationResults,
    };
  } catch (err) {
    console.error("Validation chain error:", err.message);
    throw new Error(`Failed to validate requirements: ${err.message}`);
  }
}

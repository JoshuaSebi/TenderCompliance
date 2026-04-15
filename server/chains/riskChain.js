import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3-32b",
  temperature: 0.2,
});

const riskPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a legal risk analyst specializing in vendor proposals and contracts.

Scan the vendor proposal for red-flag phrases, risky language, or concerning terms. Look for:
- Vague commitments ("best effort", "where possible", "may", "subject to")
- Liability limitations
- Unclear timelines
- Missing guarantees
- Penalty/termination clauses that favor the vendor
- Non-compliance signals

Return ONLY valid JSON with this exact structure, no markdown fences:
{{
  "redFlags": [
    {{
      "sentence": "the exact concerning sentence from the proposal",
      "riskLevel": "High",
      "explanation": "why this is a risk"
    }}
  ]
}}

riskLevel must be one of: "Low", "Medium", "High"
If no red flags are found, return {{"redFlags": []}}`,
  ],
  ["human", "{proposalText}"],
]);

const outputParser = new StringOutputParser();

const chain = RunnableSequence.from([riskPrompt, model, outputParser]);

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

export async function analyzeRisks(proposalText) {
  try {
    const raw = await chain.invoke({
      proposalText: proposalText.slice(0, 8000),
    });

    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    if (!parsed.redFlags || !Array.isArray(parsed.redFlags)) {
      return { redFlags: [] };
    }

    // Normalize
    parsed.redFlags = parsed.redFlags.map((flag) => ({
      sentence: flag.sentence || "",
      riskLevel: ["Low", "Medium", "High"].includes(flag.riskLevel)
        ? flag.riskLevel
        : "Medium",
      explanation: flag.explanation || "",
    }));

    return parsed;
  } catch (err) {
    console.error("Risk chain error:", err.message);
    // Don't throw — return empty flags so validation still works
    return { redFlags: [] };
  }
}

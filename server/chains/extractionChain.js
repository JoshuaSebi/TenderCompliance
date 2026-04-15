import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3-32b",
  temperature: 0.2,
});

const extractionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a legal and procurement analyst specializing in RFP (Request for Proposal) document analysis.

Your task: Extract ALL mandatory requirements from the given RFP text.

For each requirement, provide:
- id: sequential integer starting from 1
- text: the exact requirement text (clean, concise)
- category: one of "Technical", "Legal", or "Financial"
- keyword: the obligation keyword found — one of "shall", "must", "required", "mandatory"

Return ONLY a valid JSON object with this exact structure, no markdown fences, no explanation:
{{
  "requirements": [
    {{
      "id": 1,
      "text": "The vendor shall provide 24/7 support",
      "category": "Technical",
      "keyword": "shall"
    }}
  ]
}}`,
  ],
  ["human", "{rfpText}"],
]);

const outputParser = new StringOutputParser();

const chain = RunnableSequence.from([extractionPrompt, model, outputParser]);

/**
 * Strip markdown fences and extract JSON from LLM response
 */
function cleanJsonResponse(raw) {
  // Remove thinking tags if present (some models wrap reasoning)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Remove markdown code fences
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  // Find the JSON object
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No valid JSON found in response");
  }

  return cleaned.substring(jsonStart, jsonEnd + 1);
}

export async function extractRequirements(rfpText) {
  try {
    // Limit input to ~12k chars to stay within context window
    const truncated = rfpText.slice(0, 12000);
    const raw = await chain.invoke({ rfpText: truncated });
    const cleaned = cleanJsonResponse(raw);
    const parsed = JSON.parse(cleaned);

    // Normalize: ensure requirements array exists
    if (!parsed.requirements || !Array.isArray(parsed.requirements)) {
      throw new Error("Response missing requirements array");
    }

    // Validate and clean each requirement
    parsed.requirements = parsed.requirements.map((req, idx) => ({
      id: req.id || idx + 1,
      text: req.text || "",
      category: ["Technical", "Legal", "Financial"].includes(req.category)
        ? req.category
        : "Technical",
      keyword: ["shall", "must", "required", "mandatory"].includes(
        req.keyword?.toLowerCase()
      )
        ? req.keyword.toLowerCase()
        : "required",
    }));

    return parsed;
  } catch (err) {
    console.error("Extraction chain error:", err.message);
    throw new Error(`Failed to extract requirements: ${err.message}`);
  }
}

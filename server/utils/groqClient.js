import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "qwen/qwen3-32b";

// 🔹 Extract Requirements
export async function extractRequirements(rfpText) {
  const chat = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a legal and procurement analyst. Extract all mandatory requirements.

Return ONLY valid JSON:
{
  "requirements": [
    {
      "id": 1,
      "category": "Technical | Legal | Financial | General",
      "text": "requirement text",
      "keyword": "must | shall | required | mandatory"
    }
  ]
}`,
      },
      {
        role: "user",
        content: rfpText.slice(0, 12000),
      },
    ],
    temperature: 0.2,
  });

  try {
    const raw = chat.choices[0].message.content;

    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");

    const cleanJson = raw.substring(jsonStart, jsonEnd + 1);

    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("JSON parse failed:", err);
    return { error: "Invalid AI response", raw: chat };
  }
}

// 🔹 Compare Documents
export async function compareDocuments(rfpText, vendorText) {
  const chat = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a procurement compliance expert.

Return ONLY valid JSON:
{
  "score": 85,
  "summary": "brief summary",
  "results": [],
  "redFlags": []
}`,
      },
      {
        role: "user",
        content: `RFP:\n${rfpText.slice(0, 8000)}\n\nVendor:\n${vendorText.slice(0, 8000)}`,
      },
    ],
    temperature: 0.2,
  });

  try {
    const raw = chat.choices[0].message.content;

    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");

    const cleanJson = raw.substring(jsonStart, jsonEnd + 1);

    return JSON.parse(cleanJson); 
  } catch (err) {
    console.error("JSON parse failed:", err);
    return { error: "Invalid AI response", raw: chat };
  }
}
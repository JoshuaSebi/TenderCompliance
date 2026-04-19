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
// Scan one chunk of proposal text for red flags
// ─────────────────────────────────────────────
async function scanChunk(chunkText, chunkIndex, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const chat = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `You are a legal risk analyst specializing in vendor proposals and contracts.

Scan the vendor proposal text for red-flag phrases, risky language, or concerning terms.

Look specifically for:
- Vague commitments: "best effort", "where possible", "may", "subject to", "as applicable", "reasonable endeavours"
- Liability limitations: "limited liability", "not liable", "no responsibility", "liability capped at"
- Unclear or missing timelines: "to be determined", "as mutually agreed", no specific dates for critical milestones
- Missing guarantees: absence of SLA commitments, no penalty clause, no performance bond reference
- Clauses that favour the vendor: unilateral termination rights, unilateral price change rights, right to subcontract without approval
- Non-compliance signals: language that contradicts RFP requirements, qualifications on mandatory obligations
- Hidden cost traps: "additional fees may apply", "subject to change", "extra charges for", "out of scope"
- Exclusion clauses: "not responsible for", "excludes", "does not cover", "except where"

For each red flag found:
- sentence: copy the EXACT sentence from the proposal word for word — do not paraphrase or shorten
- riskLevel: 
    "High"   → could cause direct legal or financial damage if unchallenged
    "Medium" → ambiguous language that needs clarification before signing
    "Low"    → minor concern worth noting but unlikely to cause serious harm
- explanation: one or two sentences explaining why this is a risk to the buyer

STRICT RULES:
- Only flag sentences actually present in the provided text
- Do NOT invent, fabricate, or infer red flags
- Do NOT flag standard boilerplate that is universally acceptable
- If no red flags exist in this text, return an empty array

Return ONLY raw JSON. No markdown. No fences. Start { end }.

{
  "redFlags": [
    {
      "sentence": "exact verbatim sentence from the proposal",
      "riskLevel": "High",
      "explanation": "why this is a risk to the buyer"
    }
  ]
}

If no red flags found: { "redFlags": [] }`,
          },
          {
            role: "user",
            content: `Scan the following vendor proposal text for risk red flags. Copy flagged sentences VERBATIM.\n\nVendor Proposal:\n${chunkText}`,
          },
        ],
      });

      const raw = chat.choices[0].message.content;
      console.log(`[Risk] Chunk ${chunkIndex + 1} (first 150): ${raw.substring(0, 150)}`);

      const cleaned = cleanJsonResponse(raw);
      const parsed = JSON.parse(cleaned);

      if (!parsed.redFlags || !Array.isArray(parsed.redFlags)) return [];

      return parsed.redFlags.filter((f) => f.sentence?.trim().length > 0);

    } catch (err) {
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 3000;
        console.warn(`[Risk] Chunk ${chunkIndex + 1} rate limited. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[Risk] Chunk ${chunkIndex + 1} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === retries) return [];
      await sleep(1000 * attempt);
    }
  }

  return [];
}

// ─────────────────────────────────────────────
// Deduplicate red flags by sentence fingerprint
// ─────────────────────────────────────────────
function deduplicateFlags(flags) {
  const seen = new Set();
  return flags.filter((f) => {
    const fp = f.sentence.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export async function analyzeRisks(proposalText) {
  try {
    if (!proposalText || proposalText.trim().length < 50) {
      return { redFlags: [], summary: { total: 0, high: 0, medium: 0, low: 0 } };
    }

    // Split into 4000-char chunks with 300-char overlap
    // so red flags near chunk boundaries are not missed
    const CHUNK_SIZE = 4000;
    const OVERLAP = 300;
    const chunks = [];
    let start = 0;

    while (start < proposalText.length) {
      chunks.push(proposalText.slice(start, start + CHUNK_SIZE));
      start += CHUNK_SIZE - OVERLAP;
    }

    console.log(`[Risk] Scanning ${proposalText.length} chars in ${chunks.length} chunk(s)`);

    // Scan chunks sequentially to respect rate limits
    const allFlags = [];
    for (let i = 0; i < chunks.length; i++) {
      const flags = await scanChunk(chunks[i], i);
      allFlags.push(...flags);

      if (i < chunks.length - 1) {
        await sleep(10000); // respect TPM limit between chunks
      }
    }

    // Deduplicate flags that appeared in overlapping chunks
    const unique = deduplicateFlags(allFlags);

    // Normalize each flag
    const normalized = unique.map((flag) => ({
      sentence:    flag.sentence.trim(),
      riskLevel:   ["Low", "Medium", "High"].includes(flag.riskLevel)
                     ? flag.riskLevel
                     : "Medium",
      explanation: flag.explanation?.trim() || "No explanation provided",
    }));

    // Sort High → Medium → Low
    const riskOrder = { High: 0, Medium: 1, Low: 2 };
    normalized.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    const high   = normalized.filter((f) => f.riskLevel === "High").length;
    const medium = normalized.filter((f) => f.riskLevel === "Medium").length;
    const low    = normalized.filter((f) => f.riskLevel === "Low").length;

    console.log(`[Risk] Found: ${high} High, ${medium} Medium, ${low} Low`);

    return {
      redFlags: normalized,
      summary: { total: normalized.length, high, medium, low },
    };

  } catch (err) {
    console.error("Risk chain error:", err.message);
    // Never throw — risk scan failure should not block validation results
    return { redFlags: [], summary: { total: 0, high: 0, medium: 0, low: 0 } };
  }
}

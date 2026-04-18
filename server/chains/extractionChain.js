import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EXTRACT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const VALID_CATEGORIES = ["Technical", "Legal", "Financial", "General"];
const VALID_KEYWORDS = ["shall", "must", "required", "mandatory"];

// ─────────────────────────────────────────────
// Sleep helper for rate limit delays
// ─────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────
// JSON Cleaner + Repairer
// ─────────────────────────────────────────────
function cleanJsonResponse(raw) {
  // 1. Strip think blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip markdown fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  // 3. Find outermost { } with bracket counter
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

  let jsonStr = cleaned.substring(start, end + 1);

  // 4. Replace smart/curly quotes
  jsonStr = jsonStr
    .replace(/[\u201C\u201D]/g, '\\"')
    .replace(/[\u2018\u2019]/g, "'");

  return jsonStr;
}

// ─────────────────────────────────────────────
// STEP 1: Clean raw PDF text
// ─────────────────────────────────────────────
function cleanPdfText(text) {
  return text
    .replace(/for official use only/gi, "")
    .replace(/confidential/gi, "")
    .replace(/page \d+ of \d+/gi, "")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/[a-z]+\/[a-z]+\/[\d.]+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────
// STEP 2: Smart segment extractor
// ─────────────────────────────────────────────
function extractSegments(text) {
  const segments = [];
  const paragraphs = text.split(/\n{2,}/);
  const HAS_OBLIGATION = /\b(shall|must|required|mandatory)\b/i;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 15) continue;
    if (!HAS_OBLIGATION.test(trimmed)) continue;

    if (trimmed.length <= 600) {
      segments.push(trimmed.replace(/\s+/g, " ").trim());
      continue;
    }

    const sentences = trimmed
      .split(/(?<!\b(?:Rs|Cl|No|Mr|Dr|St|vs|ie|eg|etc|viz|Sr|Jr)\b)(?<=\.)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && HAS_OBLIGATION.test(s));

    segments.push(...sentences);
  }

  const seen = new Set();
  const unique = segments.filter((s) => {
    const fp = s.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  console.log(`Segments: ${unique.length} obligation candidates found`);
  return unique;
}

// ─────────────────────────────────────────────
// STEP 3: Classify one batch with retry on rate limit
// ─────────────────────────────────────────────
async function classifyBatch(segments, batchIndex, retries = 3) {
  // Sanitize quotes to prevent JSON parse errors
  const sanitized = segments.map((s) => s.replace(/"/g, "'"));
  const numbered = sanitized.map((s, i) => `${i + 1}. ${s}`).join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const chat = await groq.chat.completions.create({
        model: EXTRACT_MODEL,
        temperature: 0,
        max_tokens: 8000,
        messages: [
          {
            role: "system",
            content: `You are a procurement compliance classifier that works with any type of RFP, tender, or procurement document.

You will receive a numbered list of text segments. Each contains an obligation keyword (shall/must/required/mandatory).

INCLUDE if it is a genuine mandatory obligation — something a Bidder, Supplier, Vendor, or Contractor MUST do or provide.

SKIP if it is any of these:
- A definition or glossary entry ("X shall mean Y", "X shall have the meaning")
- Descriptive or background text with no actionable obligation
- A right or discretion of the issuing authority ("the Authority/Utility/Client may", "reserves the right")
- Boilerplate that imposes no specific action on the responding party

For each INCLUDED segment:
- text: copy EXACTLY as given, word for word, no changes whatsoever
- keyword: the first of "shall"/"must"/"required"/"mandatory" found in the text
- category: classify using the rules below

CATEGORY RULES — assign the MOST SPECIFIC category that fits:

"Technical" — HOW something must be done:
  submission format, signing, sealing, marking, labelling, language of submission,
  deadlines, validity periods, document preparation rules, attendance requirements,
  operational obligations, specifications, procedures, formatting rules,
  methods of delivery, communication requirements

"Financial" — MONEY and SECURITY obligations:
  bid security, earnest money deposit, bank guarantee, demand draft, bonds,
  performance security, tariff, pricing, costs, fees, payments, charges,
  deposits, refunds, forfeiture, financial instruments, cost-bearing obligations

"Legal" — COMPLIANCE and CONSEQUENCE obligations:
  fraud, corruption, ethics, anti-bribery, disqualification conditions,
  misrepresentation, jurisdiction, governing law, courts, arbitration,
  power of attorney, ownership or control changes, termination conditions,
  penalties, statutory compliance, regulatory requirements, contractual obligations,
  confidentiality, intellectual property, indemnification

"General" — Use ONLY when the obligation is genuinely administrative or
  does not fit Technical, Financial, or Legal at all.
  DO NOT use General as a default or fallback.
  If unsure between two categories, pick the MORE SPECIFIC one.

Return ONLY raw JSON. No markdown. No fences. No explanation. Start with { end with }.

{
  "requirements": [
    {
      "text": "exact text as provided",
      "category": "Technical",
      "keyword": "shall"
    }
  ]
}

If nothing qualifies: { "requirements": [] }`,
          },
          {
            role: "user",
            content: `Classify these procurement document segments. Include only genuine mandatory obligations:\n\n${numbered}`,
          },
        ],
      });

      const raw = chat.choices[0].message.content;

      // Debug logs — remove in production
      console.log(`\n=== Batch ${batchIndex + 1} (attempt ${attempt}) ===`);
      console.log(`Length: ${raw.length} | Finish: ${chat.choices[0].finish_reason}`);
      console.log(`Last 100: ...${raw.substring(raw.length - 100)}`);

      if (chat.choices[0].finish_reason === "length") {
        console.warn(`Batch ${batchIndex + 1} truncated — response too long`);
      }

      const cleaned = cleanJsonResponse(raw);
      const parsed = JSON.parse(cleaned);

      if (!parsed.requirements || !Array.isArray(parsed.requirements)) return [];

      return parsed.requirements.filter((r) => r.text?.trim().length > 0);

    } catch (err) {
      // Rate limit — wait exact time from error message then retry
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 3000;

        console.warn(`Batch ${batchIndex + 1} rate limited. Waiting ${waitMs}ms (retry ${attempt}/${retries})...`);
        await sleep(waitMs);
        continue;
      }

      // Model decommissioned — no point retrying
      if (err.status === 400 && err.message?.includes("decommissioned")) {
        console.error(`Model decommissioned. Update EXTRACT_MODEL in extractionChain.js`);
        throw err; // bubble up immediately, don't retry
      }

      // Other error — log and retry with backoff
      console.error(`Batch ${batchIndex + 1} failed (attempt ${attempt}): ${err.message}`);

      if (attempt === retries) {
        console.error(`Batch ${batchIndex + 1} permanently failed after ${retries} attempts`);
        return [];
      }

      await sleep(1000 * attempt);
    }
  }

  return [];
}

// ─────────────────────────────────────────────
// STEP 4: Scanned PDF detection
// ─────────────────────────────────────────────
function detectScannedPdf(text, pageCount) {
  const avg = text.length / Math.max(pageCount || 1, 1);
  if (avg < 100) {
    throw new Error(
      "PDF appears to be scanned. Please upload a text-based PDF or run OCR first."
    );
  }
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export async function extractRequirements(rfpText, options = {}) {
  try {
    const { pageCount } = options;

    if (pageCount) detectScannedPdf(rfpText, pageCount);

    if (!rfpText || rfpText.trim().length < 100) {
      throw new Error("RFP text too short — check PDF extraction");
    }

    const obligationCount = (
      rfpText.match(/\b(shall|must|required|mandatory)\b/gi) || []
    ).length;

    console.log("\n=== EXTRACTION START ===");
    console.log(`Chars    : ${rfpText.length}`);
    console.log(`Keywords : ${obligationCount}`);
    console.log(`Pages    : ${pageCount || "unknown"}`);
    console.log("========================\n");

    const cleanedText = cleanPdfText(rfpText);
    const candidates = extractSegments(cleanedText);

    if (candidates.length === 0) {
      return {
        requirements: [],
        warning: "No obligation keywords found. Check PDF text extraction.",
      };
    }

    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      batches.push(candidates.slice(i, i + BATCH_SIZE));
    }

    console.log(`${candidates.length} candidates → ${batches.length} batches of ${BATCH_SIZE}`);

    // Sequential with delay to respect TPM rate limits
    const allResults = [];
    for (let i = 0; i < batches.length; i++) {
      const result = await classifyBatch(batches[i], i);
      allResults.push(result);

      if (i < batches.length - 1) {
        console.log(`Waiting 10s before batch ${i + 2}...`);
        await sleep(10000);
      }
    }

    const normalized = allResults
      .flat()
      .map((req, idx) => ({
        id: idx + 1,
        text: req.text.trim(),
        category: VALID_CATEGORIES.includes(req.category) ? req.category : "General",
        keyword: VALID_KEYWORDS.includes(req.keyword?.toLowerCase())
          ? req.keyword.toLowerCase()
          : "required",
      }));

    console.log(`\n=== DONE ===`);
    console.log(`Candidates : ${candidates.length}`);
    console.log(`Extracted  : ${normalized.length}`);
    console.log(`============\n`);

    return { requirements: normalized };
  } catch (err) {
    console.error("Extraction error:", err.message);
    throw new Error(`Failed to extract requirements: ${err.message}`);
  }
}

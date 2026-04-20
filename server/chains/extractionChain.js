import Groq from "groq-sdk";
import { extractWithVerification } from "../graphs/extractionGraph.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EXTRACT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const VALID_CATEGORIES = ["Technical", "Legal", "Financial", "General"];
const VALID_KEYWORDS   = ["shall", "must", "required", "mandatory"];

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
// STEP 3: Classify batch — exported so extractionGraph can reuse it
// Single source of truth for the classification prompt
// ─────────────────────────────────────────────
export async function classifyBatch(segments, batchIndex, retries = 3) {
  const sanitized = segments.map((s) => s.replace(/"/g, "'"));
  const numbered  = sanitized.map((s, i) => `${i + 1}. ${s}`).join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const chat = await groq.chat.completions.create({
        model: EXTRACT_MODEL,
        temperature: 0,
        max_tokens: 8000,
        messages: [
          {
            role: "system",
            content: `You are a procurement compliance classifier that works with any RFP, tender, contract, or procurement document regardless of industry or jurisdiction.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INCLUDE — genuine mandatory obligations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include a segment ONLY if it imposes a clear, actionable obligation on the Bidder, Vendor, Supplier, Contractor, or Selected Party — something they MUST do, provide, submit, or comply with.

Special rule for list segments:
If a segment introduces sub-items (a)(b)(c) or numbered points, copy the ENTIRE segment including ALL sub-items verbatim. Do NOT extract only the first sub-item.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKIP — do NOT include these
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Definitions and glossary entries
   ("X shall mean Y", "X shall have the meaning", "for the purposes of this RFP")
2. Descriptive or background text
   (explains context, history, or purpose with no actionable obligation)
3. Authority discretion and reserved rights
   ("the Authority/Client/Utility may", "reserves the right to", "at its sole discretion")
4. Evaluation methodology descriptions
   (how the Authority will score or evaluate bids — obligations on the Authority, not the Bidder)
5. Scoring formulas and weightages
   ("Technical Score 70% + Financial Score 30%", "QCBS methodology")
6. Introductory list headers without standalone obligation
   ("The Bidder must include the following:" — skip the header, include the list items only if they follow)
7. Administrative and contact information
   (addresses, email, phone numbers, submission office details)
8. Permission statements — rights given TO the Bidder, not obligations ON the Bidder
   ("A Bidder may modify or withdraw its Bid" — this is a right, not a requirement)
9. Penalty or consequence caps that limit the Authority's actions
   ("aggregate penalties shall not exceed X%" — this constrains the Authority, not the Bidder)
10. Pure informational references
    ("Bidders shall refer to Annexure A" — informational direction, not an actionable obligation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR EACH INCLUDED SEGMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- text     : copy EXACTLY word for word as provided — do not change, shorten, or paraphrase a single word
- category : assign the MOST SPECIFIC category using rules below
- keyword  : the FIRST of "shall" / "must" / "required" / "mandatory" found in the text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Technical" — HOW something must be done by the Bidder:
  Submission format, document preparation, signing, sealing, marking, labelling,
  language requirements, page numbering, deadlines, bid validity periods,
  envelope instructions, attendance at conferences, clarification procedures,
  operational specifications, uptime/SLA obligations, technical certifications,
  data handling procedures, encryption standards, disaster recovery obligations,
  infrastructure requirements, delivery methods, reporting obligations

"Financial" — MONEY and SECURITY obligations on the Bidder:
  Bid security, earnest money deposit, bank guarantee, demand draft, bonds,
  performance security, tariff, pricing, cost schedules, payment submission,
  fees, charges, deposits, forfeiture conditions, tax obligations,
  cost-bearing responsibilities, financial eligibility thresholds

"Legal" — COMPLIANCE and CONSEQUENCE obligations on the Bidder:
  Fraud and corruption prohibitions, ethical conduct requirements,
  disqualification conditions, misrepresentation consequences,
  jurisdiction and governing law acceptance, court/arbitration clauses,
  power of attorney requirements, ownership or control change disclosures,
  termination triggers caused by Bidder actions, IP assignment obligations,
  confidentiality obligations, statutory and regulatory compliance,
  conflict of interest disclosures, indemnification obligations,
  data protection and privacy law compliance

"General" — Use ONLY when the obligation is genuinely administrative and
  does not fit Technical, Financial, or Legal in any reasonable interpretation.
  DO NOT use General as a default or fallback.
  If unsure between two categories, always pick the MORE SPECIFIC one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY a raw JSON object.
No markdown. No code fences. No explanation. No text before or after.
Start your response with { and end with }.

{
  "requirements": [
    {
      "text": "exact text as provided",
      "category": "Technical",
      "keyword": "shall"
    }
  ]
}

If no segments qualify: { "requirements": [] }`,
          },
          {
            role: "user",
            content: `Classify these procurement document segments:\n\n${numbered}`,
          },
        ],
      });

      const raw = chat.choices[0].message.content;

      console.log(`\n=== Batch ${batchIndex + 1} (attempt ${attempt}) ===`);
      console.log(`Length: ${raw.length} | Finish: ${chat.choices[0].finish_reason}`);
      console.log(`Last 100: ...${raw.substring(raw.length - 100)}`);

      if (chat.choices[0].finish_reason === "length") {
        console.warn(`Batch ${batchIndex + 1} truncated — reduce BATCH_SIZE`);
      }

      const cleaned = cleanJsonResponse(raw);
      const parsed  = JSON.parse(cleaned);

      if (!parsed.requirements || !Array.isArray(parsed.requirements)) return [];

      return parsed.requirements.filter((r) => r.text?.trim().length > 0);

    } catch (err) {
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 3000;
        console.warn(`Batch ${batchIndex + 1} rate limited. Waiting ${waitMs}ms (retry ${attempt}/${retries})...`);
        await sleep(waitMs);
        continue;
      }

      if (err.status === 400 && err.message?.includes("decommissioned")) {
        console.error("Model decommissioned. Update EXTRACT_MODEL in extractionChain.js");
        throw err;
      }

      console.error(`Batch ${batchIndex + 1} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === retries) return [];
      await sleep(1000 * attempt);
    }
  }

  return [];
}

// ─────────────────────────────────────────────
// Scanned PDF detection
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
    const { pageCount, useVerification = true } = options;

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
    console.log(`Mode     : ${useVerification ? "LangGraph (extract + verify)" : "Direct classify"}`);
    console.log("========================\n");

    const cleanedText = cleanPdfText(rfpText);
    const candidates  = extractSegments(cleanedText);

    if (candidates.length === 0) {
      return {
        requirements:       [],
        unsureRequirements: [],
        warning: "No obligation keywords found. Check PDF text extraction.",
      };
    }

    // ── MODE A: LangGraph with verification + unsure tracking ──
    if (useVerification) {
      console.log(`Passing ${candidates.length} candidates to LangGraph pipeline...`);
      const result = await extractWithVerification(rfpText, candidates);

      console.log(`\n=== DONE ===`);
      console.log(`Candidates  : ${candidates.length}`);
      console.log(`Verified    : ${result.requirements.length}`);
      console.log(`Unsure      : ${result.unsureRequirements?.length || 0}`);
      if (result.stats) {
        console.log(`Hallucinations : ${result.stats.hallucinationsDetected}`);
        console.log(`Recovered      : ${result.stats.recovered}`);
      }
      console.log(`============\n`);

      return result; // includes requirements, unsureRequirements, stats
    }

    // ── MODE B: Direct classify (no verification) ──
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      batches.push(candidates.slice(i, i + BATCH_SIZE));
    }

    console.log(`Direct mode: ${candidates.length} candidates → ${batches.length} batches`);

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
        id:       idx + 1,
        text:     req.text.trim(),
        category: VALID_CATEGORIES.includes(req.category) ? req.category : "General",
        keyword:  VALID_KEYWORDS.includes(req.keyword?.toLowerCase())
                    ? req.keyword.toLowerCase()
                    : "required",
        verified: false, // not verified in direct mode
        unsure:   false,
      }));

    console.log(`\n=== DONE ===`);
    console.log(`Candidates : ${candidates.length}`);
    console.log(`Extracted  : ${normalized.length}`);
    console.log(`============\n`);

    return {
      requirements:       normalized,
      unsureRequirements: [],
    };

  } catch (err) {
    console.error("Extraction error:", err.message);
    throw new Error(`Failed to extract requirements: ${err.message}`);
  }
}

import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";

// ─────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────
const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  temperature: 0,
  maxTokens: 8000,
});

const VALID_CATEGORIES = ["Technical", "Legal", "Financial", "General"];
const VALID_KEYWORDS   = ["shall", "must", "required", "mandatory"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────
// JSON Cleaner
// ─────────────────────────────────────────────
function cleanJson(raw) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON found in response");

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
// STEP 1: Clean PDF text
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
// STEP 2: Regex segment extractor — no AI, instant
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
  return segments.filter((s) => {
    const fp = s.toLowerCase().replace(/\s+/g, " ").substring(0, 80);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

// ─────────────────────────────────────────────
// LangChain Chain 1: Classification Chain
// Takes a batch of segments → returns classified requirements
// ─────────────────────────────────────────────
const classifyPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a procurement compliance classifier that works with any RFP, tender, contract, or procurement document regardless of industry or jurisdiction.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INCLUDE — genuine mandatory obligations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include a segment ONLY if it imposes a clear, actionable obligation on the Bidder, Vendor, Supplier, Contractor, or Selected Party.

Special rule: If a segment has sub-items (a)(b)(c), copy the ENTIRE segment including ALL sub-items verbatim.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKIP — do NOT include these
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Definitions ("X shall mean Y")
2. Descriptive or background text
3. Authority discretion ("Authority may", "reserves the right")
4. Evaluation methodology descriptions
5. Scoring formulas ("Technical Score 70% + Financial Score 30%")
6. Introductory list headers ("The Bidder must include the following:")
7. Administrative/contact information
8. Permission statements — rights given TO the Bidder ("A Bidder may modify")
9. Penalty caps limiting the Authority ("penalties shall not exceed X%")
10. Pure informational references ("Bidders shall refer to Annexure A")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR EACH INCLUDED SEGMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- text: copy EXACTLY word for word — do not change a single word
- category: most specific category (rules below)
- keyword: FIRST of "shall"/"must"/"required"/"mandatory" in text

CATEGORY RULES:
"Technical" — HOW to submit: format, signing, sealing, deadlines, validity, procedures, SLA, specs, encryption, DR, reporting
"Financial" — MONEY: bid security, guarantee, payment, fees, costs, tariff, deposit, forfeiture, tax
"Legal"     — COMPLIANCE: fraud, ethics, disqualification, jurisdiction, law, termination, IP, confidentiality, conflict of interest
"General"   — Only if genuinely does not fit above. NOT a default. Never use as fallback.

Return ONLY raw JSON. No markdown. No fences. Start {{ end }}.
{{
  "requirements": [
    {{"text": "exact text", "category": "Technical", "keyword": "shall"}}
  ]
}}
If none qualify: {{"requirements": []}}`,
  ],
  ["human", "Classify these procurement document segments:\n\n{segments}"],
]);

const classifyChain = RunnableSequence.from([
  classifyPrompt,
  model,
  new StringOutputParser(),
]);

// ─────────────────────────────────────────────
// LangChain Chain 2: Verification Chain
// Takes a batch of requirements + source text → returns verdicts
// ─────────────────────────────────────────────
const verifyPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a hallucination detector for a document extraction system.

For EACH requirement in the list, check if the exact text appears in the source document.

Verdict options:
- "verbatim"    → appears word-for-word or with only minor whitespace/punctuation differences
- "paraphrased" → meaning similar but wording different (HALLUCINATION)
- "invented"    → does not appear in source at all (HALLUCINATION)

Be lenient with minor formatting differences. Be strict about word changes.

Return ONLY raw JSON. No markdown. Start {{ end }}.
{{
  "verifications": [
    {{"index": 1, "verdict": "verbatim", "issue": null}},
    {{"index": 2, "verdict": "paraphrased", "issue": "Source says X but extracted says Y"}}
  ]
}}`,
  ],
  [
    "human",
    "SOURCE DOCUMENT:\n{sourceText}\n\nREQUIREMENTS TO VERIFY:\n{requirements}",
  ],
]);

const verifyChain = RunnableSequence.from([
  verifyPrompt,
  model,
  new StringOutputParser(),
]);

// ─────────────────────────────────────────────
// Run classify chain on one batch with retry
// ─────────────────────────────────────────────
async function runClassifyBatch(segments, batchIndex, retries = 3) {
  const numbered = segments
    .map((s, i) => `${i + 1}. ${s.replace(/"/g, "'")}`)
    .join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = await classifyChain.invoke({ segments: numbered });
      console.log(`[Classify] Batch ${batchIndex + 1} length: ${raw.length}`);

      const parsed = JSON.parse(cleanJson(raw));
      if (!parsed.requirements || !Array.isArray(parsed.requirements)) return [];

      return parsed.requirements.filter((r) => r.text?.trim().length > 0);
    } catch (err) {
      // Rate limit — wait and retry
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 5000;
        console.warn(`[Classify] Batch ${batchIndex + 1} rate limited. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[Classify] Batch ${batchIndex + 1} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === retries) return [];
      await sleep(1000 * attempt);
    }
  }
  return [];
}

// ─────────────────────────────────────────────
// Run verify chain on one batch with retry
// ─────────────────────────────────────────────
async function runVerifyBatch(requirements, sourceText, batchIndex, retries = 3) {
  const reqList = requirements
    .map((r, i) => `[${i + 1}] "${r.text}"`)
    .join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = await verifyChain.invoke({
        sourceText: sourceText.substring(0, 12000),
        requirements: reqList,
      });
      console.log(`[Verify] Batch ${batchIndex + 1} length: ${raw.length}`);

      const parsed = JSON.parse(cleanJson(raw));
      if (!parsed.verifications || !Array.isArray(parsed.verifications)) {
        // Verification failed — treat all as verified to avoid data loss
        return requirements.map((r, i) => ({ ...r, verdict: "unknown", unsure: false }));
      }

      return parsed.verifications.map((v) => {
        const req = requirements[v.index - 1];
        if (!req) return null;
        return {
          ...req,
          verdict: v.verdict,
          issue:   v.issue || null,
          unsure:  v.verdict !== "verbatim",
        };
      }).filter(Boolean);

    } catch (err) {
      if (err.status === 429 || err.message?.includes("429")) {
        const waitMatch = err.message?.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500
          : attempt * 5000;
        console.warn(`[Verify] Batch ${batchIndex + 1} rate limited. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[Verify] Batch ${batchIndex + 1} failed (attempt ${attempt}): ${err.message}`);
      if (attempt === retries) {
        // Verification failed — treat all as verified to avoid losing requirements
        return requirements.map((r) => ({ ...r, verdict: "unknown", unsure: false }));
      }
      await sleep(1000 * attempt);
    }
  }
  return requirements.map((r) => ({ ...r, verdict: "unknown", unsure: false }));
}

// ─────────────────────────────────────────────
// Full LangChain pipeline as a RunnableSequence
// Step 1: classify all segments in batches
// Step 2: verify all classified requirements in batches (once, no loop)
// ─────────────────────────────────────────────
const extractionPipeline = RunnableSequence.from([

  // Stage 1: classify segments into requirements
  new RunnableLambda({
    func: async ({ segments, sourceText }) => {
      console.log(`\n[Pipeline: Classify] ${segments.length} segments`);

      const BATCH_SIZE = 5;
      const allRequirements = [];

      for (let i = 0; i < segments.length; i += BATCH_SIZE) {
        const batch      = segments.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);
        const result     = await runClassifyBatch(batch, batchIndex);

        console.log(`[Pipeline: Classify] Batch ${batchIndex + 1} → ${result.length} requirements`);
        allRequirements.push(...result);

        if (i + BATCH_SIZE < segments.length) {
          console.log(`[Pipeline: Classify] Waiting 10s...`);
          await sleep(10000);
        }
      }

      console.log(`[Pipeline: Classify] Total classified: ${allRequirements.length}`);
      return { classified: allRequirements, sourceText };
    },
  }),

  // Stage 2: verify all classified requirements once
  new RunnableLambda({
    func: async ({ classified, sourceText }) => {
      console.log(`\n[Pipeline: Verify] Checking ${classified.length} requirements`);

      const BATCH_SIZE = 10;
      const allVerified = [];

      for (let i = 0; i < classified.length; i += BATCH_SIZE) {
        const batch      = classified.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);
        const result     = await runVerifyBatch(batch, sourceText, batchIndex);

        allVerified.push(...result);

        if (i + BATCH_SIZE < classified.length) {
          console.log(`[Pipeline: Verify] Waiting 10s...`);
          await sleep(10000);
        }
      }

      const verified = allVerified.filter((r) => !r.unsure);
      const unsure   = allVerified.filter((r) => r.unsure);

      console.log(`[Pipeline: Verify] Verified: ${verified.length} | Unsure: ${unsure.length}`);
      return { verified, unsure };
    },
  }),

]);

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
    console.log(`Mode     : ${useVerification ? "LangChain (classify + verify)" : "Regex only"}`);
    console.log("========================\n");

    // Step 1: Clean and find candidate segments
    const cleanedText = cleanPdfText(rfpText);
    const candidates  = extractSegments(cleanedText);

    console.log(`Segments: ${candidates.length} obligation candidates found`);

    if (candidates.length === 0) {
      return {
        requirements:       [],
        unsureRequirements: [],
        warning: "No obligation keywords found. Check PDF text extraction.",
      };
    }

    // ── MODE A: LangChain classify + verify pipeline ──
    if (useVerification) {
      const { verified, unsure } = await extractionPipeline.invoke({
        segments:   candidates,
        sourceText: rfpText,
      });

      // Normalize verified requirements
      const requirements = verified.map((req, idx) => ({
        id:       idx + 1,
        text:     req.text.trim(),
        category: VALID_CATEGORIES.includes(req.category) ? req.category : "General",
        keyword:  VALID_KEYWORDS.includes(req.keyword?.toLowerCase())
                    ? req.keyword.toLowerCase()
                    : "required",
        verified: true,
        unsure:   false,
      }));

      // Normalize unsure requirements
      const unsureRequirements = unsure.map((req, idx) => ({
        id:       `U${idx + 1}`,
        text:     req.text.trim(),
        category: VALID_CATEGORIES.includes(req.category) ? req.category : "General",
        keyword:  VALID_KEYWORDS.includes(req.keyword?.toLowerCase())
                    ? req.keyword.toLowerCase()
                    : "required",
        verified: false,
        unsure:   true,
        issue:    req.issue || "Could not verify against source document",
      }));

      console.log(`\n=== DONE ===`);
      console.log(`Candidates  : ${candidates.length}`);
      console.log(`Verified    : ${requirements.length}`);
      console.log(`Unsure      : ${unsureRequirements.length}`);
      console.log(`============\n`);

      return {
        requirements,
        unsureRequirements,
        stats: {
          total:  requirements.length,
          unsure: unsureRequirements.length,
          hallucinationsDetected: unsure.length,
          recovered: 0,
        },
      };
    }

    // ── MODE B: Regex-only classification (no LLM, instant) ──
    // Use when rate limits are an issue or speed is priority
    const requirements = candidates.map((text, idx) => {
      const kwMatch  = text.match(/\b(shall|must|required|mandatory)\b/i);
      const keyword  = kwMatch ? kwMatch[1].toLowerCase() : "required";
      const t        = text.toLowerCase();

      let category = "General";
      if (/bid security|bank guarantee|demand draft|performance security|payment|invoice|fee|cost|tariff|price|deposit|refund|forfeit|tax|gst|tds|turnover|crore|lakh|rupee|inr/.test(t)) {
        category = "Financial";
      } else if (/fraud|corrupt|ethic|disqualif|misrepresent|jurisdiction|court|arbitrat|power of attorney|ownership|terminat|intellectual property|confidential|statutory|comply|law|regulation|liable|liability/.test(t)) {
        category = "Legal";
      } else if (/format|sign|seal|mark|submit|deadline|valid|envelope|language|page|document|certif|upload|deliver|encrypt|uptime|sla|backup|recovery|patch|monitor|deploy|report|specification/.test(t)) {
        category = "Technical";
      }

      return {
        id:       idx + 1,
        text:     text.trim(),
        category,
        keyword,
        verified: false,
        unsure:   false,
      };
    });

    console.log(`\n=== DONE (regex mode) ===`);
    console.log(`Candidates : ${candidates.length}`);
    console.log(`Extracted  : ${requirements.length}`);
    console.log(`===============\n`);

    return {
      requirements,
      unsureRequirements: [],
      stats: { total: requirements.length, unsure: 0 },
    };

  } catch (err) {
    console.error("Extraction error:", err.message);
    throw new Error(`Failed to extract requirements: ${err.message}`);
  }
}

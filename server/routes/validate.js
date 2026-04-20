import express from "express";
import multer from "multer";
import { extractText } from "../utils/pdfParser.js";
import { extractRequirements } from "../chains/extractionChain.js";
import { validateRequirements } from "../chains/validationChain.js";
import { analyzeRisks } from "../chains/riskChain.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────
// POST /extract
// Step 1: Upload RFP PDF → extract + verify requirements
// Frontend stores the returned requirements and passes them to /validate
// ─────────────────────────────────────────────
router.post("/extract", upload.single("rfp"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No RFP file uploaded" });
    }

    const { text: rfpText, pageCount } = await extractText(req.file.buffer);

    const obligationCount = (
      rfpText.match(/\b(shall|must|required|mandatory)\b/gi) || []
    ).length;

    console.log("\n=== /extract called ===");
    console.log(`File     : ${req.file.originalname}`);
    console.log(`Pages    : ${pageCount}`);
    console.log(`Chars    : ${rfpText.length}`);
    console.log(`Keywords : ${obligationCount}`);
    console.log("=======================\n");

    // Run full LangGraph extraction + verification pipeline
    const result = await extractRequirements(rfpText, {
      pageCount,
      useVerification: true, // full pipeline — runs once here, not on every validate
    });

    console.log(`Extracted: ${result.requirements.length} verified, ${result.unsureRequirements?.length || 0} unsure`);

    res.json({
      success: true,
      data: {
        requirements:       result.requirements,
        unsureRequirements: result.unsureRequirements || [],
        warning:            result.warning || null,
        stats: result.stats || {
          total:                  result.requirements.length,
          unsure:                 result.unsureRequirements?.length || 0,
          hallucinationsDetected: 0,
          recovered:              0,
          pageCount,
          obligationKeywordsFound: obligationCount,
        },
      },
    });
  } catch (err) {
    console.error("Extract error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /validate
// Step 2: Upload vendor PDF + send pre-extracted requirements from Step 1
// Does NOT re-extract from RFP — uses what Step 1 already produced
//
// Request: multipart/form-data
//   - vendor: PDF file
//   - requirements: JSON string of requirements array from /extract response
// ─────────────────────────────────────────────
router.post(
  "/validate",
  upload.fields([{ name: "vendor" }]),
  async (req, res) => {
    try {
      // Validate vendor file
      if (!req.files?.vendor?.[0]) {
        return res.status(400).json({
          success: false,
          error: "Vendor PDF file is required",
        });
      }

      // Requirements must come from the frontend (from a previous /extract call)
      if (!req.body?.requirements) {
        return res.status(400).json({
          success: false,
          error: "requirements field is required — run /extract first and pass the result here",
        });
      }

      // Parse requirements from request body
      let requirements;
      try {
        requirements = JSON.parse(req.body.requirements);
      } catch {
        return res.status(400).json({
          success: false,
          error: "requirements must be a valid JSON array",
        });
      }

      if (!Array.isArray(requirements) || requirements.length === 0) {
        return res.status(400).json({
          success: false,
          error: "requirements array is empty — run /extract first",
        });
      }

      // Parse unsure requirements if provided
      let unsureRequirements = [];
      if (req.body?.unsureRequirements) {
        try {
          unsureRequirements = JSON.parse(req.body.unsureRequirements);
        } catch {
          unsureRequirements = [];
        }
      }

      // Extract vendor text
      const { text: vendorText, pageCount: vendorPageCount } =
        await extractText(req.files["vendor"][0].buffer);

      console.log("\n=== /validate called ===");
      console.log(`Vendor   : ${vendorPageCount} pages, ${vendorText.length} chars`);
      console.log(`Requirements received: ${requirements.length}`);
      console.log(`Unsure received      : ${unsureRequirements.length}`);
      console.log("========================\n");

      if (!vendorText || vendorText.trim().length < 50) {
        throw new Error("Vendor text extraction failed — file may be scanned or corrupted");
      }

      // Step 1: Validate vendor proposal against ALL pre-extracted requirements
      console.log(`Step 1: Validating ${requirements.length} requirements...`);
      const validation = await validateRequirements(requirements, vendorText);
      console.log(`Step 1 done: Score ${validation.score}%`);

      // Step 2: Risk analysis on vendor proposal
      console.log("Step 2: Analyzing risks...");
      const risks = await analyzeRisks(vendorText);
      console.log(`Step 2 done: ${risks.summary?.total || 0} red flags`);

      res.json({
        success: true,
        data: {
          // Compliance scores
          score:      validation.score,
          total:      validation.total,
          met:        validation.met,
          partial:    validation.partial,
          missing:    validation.missing,
          byCategory: validation.byCategory || {},
          results:    validation.results,

          // Unsure requirements — passed through from extraction step
          unsureRequirements,

          // Risk analysis
          redFlags:    risks.redFlags,
          riskSummary: risks.summary || { total: 0, high: 0, medium: 0, low: 0 },
        },
      });

    } catch (err) {
      console.error("Validate error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Validation failed",
      });
    }
  }
);

// ─────────────────────────────────────────────
// POST /validate-full
// Convenience route: does both extraction + validation in one call
// Use only when you don't need to cache/reuse extracted requirements
// WARNING: slow — runs full LangGraph pipeline + validation sequentially
// Use useVerification: false to skip LangGraph for faster results
// ─────────────────────────────────────────────
router.post(
  "/validate-full",
  upload.fields([{ name: "rfp" }, { name: "vendor" }]),
  async (req, res) => {
    try {
      if (!req.files?.rfp?.[0] || !req.files?.vendor?.[0]) {
        return res.status(400).json({
          success: false,
          error: "Both RFP and vendor PDF files are required",
        });
      }

      const { text: rfpText,    pageCount: rfpPageCount    } = await extractText(req.files["rfp"][0].buffer);
      const { text: vendorText, pageCount: vendorPageCount } = await extractText(req.files["vendor"][0].buffer);

      console.log("\n=== /validate-full called ===");
      console.log(`RFP    : ${rfpPageCount} pages, ${rfpText.length} chars`);
      console.log(`Vendor : ${vendorPageCount} pages, ${vendorText.length} chars`);
      console.log("=============================\n");

      if (!rfpText || rfpText.trim().length < 100) {
        throw new Error("RFP text extraction failed");
      }
      if (!vendorText || vendorText.trim().length < 50) {
        throw new Error("Vendor text extraction failed");
      }

      // Extract without LangGraph verification for speed
      // Change to useVerification: true if hallucination checking is needed
      console.log("Step 1: Extracting requirements (direct mode)...");
      const extractionResult = await extractRequirements(rfpText, {
        pageCount: rfpPageCount,
        useVerification: false, // fast — skips LangGraph
      });

      const { requirements, unsureRequirements = [] } = extractionResult;

      if (!requirements?.length) {
        throw new Error("No requirements could be extracted from the RFP");
      }

      console.log(`Step 1 done: ${requirements.length} requirements`);

      console.log("Step 2: Validating...");
      const validation = await validateRequirements(requirements, vendorText);
      console.log(`Step 2 done: Score ${validation.score}%`);

      console.log("Step 3: Analyzing risks...");
      const risks = await analyzeRisks(vendorText);
      console.log(`Step 3 done: ${risks.summary?.total || 0} red flags`);

      res.json({
        success: true,
        data: {
          score:             validation.score,
          total:             validation.total,
          met:               validation.met,
          partial:           validation.partial,
          missing:           validation.missing,
          byCategory:        validation.byCategory || {},
          results:           validation.results,
          unsureRequirements,
          redFlags:          risks.redFlags,
          riskSummary:       risks.summary || { total: 0, high: 0, medium: 0, low: 0 },
          extractionStats:   extractionResult.stats || { total: requirements.length },
        },
      });

    } catch (err) {
      console.error("Validate-full error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Validation failed",
      });
    }
  }
);

export default router;

import express from "express";
import multer from "multer";
import { extractText } from "../utils/pdfParser.js";
import { extractRequirements } from "../chains/extractionChain.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────
// POST /upload
// Upload PDF and return raw extracted text
// Used to preview what the parser produces
// ─────────────────────────────────────────────
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const { text, pageCount } = await extractText(req.file.buffer);

    res.json({
      success: true,
      text,
      pageCount,
      totalChars: text.length,
      obligationKeywords: (text.match(/\b(shall|must|required|mandatory)\b/gi) || []).length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /extract
// Full pipeline: PDF → text → LangGraph extraction + verification
// ─────────────────────────────────────────────
router.post("/extract", upload.single("rfp"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No RFP file uploaded" });
    }

    // Step 1: Extract text from PDF
    const { text: rfpText, pageCount } = await extractText(req.file.buffer);

    // Step 2: Log diagnostics
    const obligationCount = (
      rfpText.match(/\b(shall|must|required|mandatory)\b/gi) || []
    ).length;

    console.log("\n=== /extract called ===");
    console.log(`File     : ${req.file.originalname}`);
    console.log(`Size     : ${(req.file.size / 1024).toFixed(1)} KB`);
    console.log(`Pages    : ${pageCount}`);
    console.log(`Chars    : ${rfpText.length}`);
    console.log(`Keywords : ${obligationCount}`);
    console.log("=======================\n");

    // Step 3: Run extraction + verification pipeline
    const result = await extractRequirements(rfpText);

    console.log(`Final requirements: ${result.requirements.length}`);

    // Step 4: Return full result including stats from LangGraph
    res.json({
      success: true,
      data: {
        requirements: result.requirements,
        unsureRequirements: result.unsureRequirements || [],
        warning: result.warning || null,
        stats: result.stats
          ? {
              total: result.stats.total,
              unsure: result.stats.unsure || 0,
              hallucinationsDetected: result.stats.hallucinationsDetected,
              recovered: result.stats.recovered,
              pageCount,
              obligationKeywordsFound: obligationCount,
            }
          : {
              total: result.requirements.length,
              unsure: 0,
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
// POST /debug-text
// Dev tool: see raw extracted text from PDF
// Remove in production
// ─────────────────────────────────────────────
router.post("/debug-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const { text, pageCount } = await extractText(req.file.buffer);
    const obligationCount = (
      text.match(/\b(shall|must|required|mandatory)\b/gi) || []
    ).length;

    res.json({
      pageCount,
      totalChars: text.length,
      obligationKeywords: obligationCount,
      avgCharsPerPage: Math.round(text.length / Math.max(pageCount, 1)),
      preview: text.substring(0, 3000),
      middle: text.substring(Math.floor(text.length / 2), Math.floor(text.length / 2) + 1000),
    });
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

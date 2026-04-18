import express from "express";
import multer from "multer";
import { extractText } from "../utils/pdfParser.js";
import { extractRequirements } from "../chains/extractionChain.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload PDF and return raw text
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }
    const { text, pageCount } = await extractText(req.file.buffer);
    res.json({ success: true, text, pageCount });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Extract requirements from RFP (Mode 1)
router.post("/extract", upload.single("rfp"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No RFP file uploaded" });
    }

    const { text: rfpText, pageCount } = await extractText(req.file.buffer);

    // ── ADD THESE 3 LINES ──
    const obligationCount = (rfpText.match(/\b(shall|must|required|mandatory)\b/gi) || []).length;
    console.log("Total chars:", rfpText.length);
    console.log("Obligation keywords found:", obligationCount);
    console.log("Page count:", pageCount);
    // ── END DEBUG ──

    const result = await extractRequirements(rfpText, { pageCount });

    // ── ADD THIS TOO ──
    console.log("Final requirements count:", result.requirements.length);
    // ──────────────────

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Extract error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
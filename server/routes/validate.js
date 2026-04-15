import express from "express";
import multer from "multer";
import { extractText } from "../utils/pdfParser.js";
import { extractRequirements } from "../chains/extractionChain.js";
import { validateRequirements } from "../chains/validationChain.js";
import { analyzeRisks } from "../chains/riskChain.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Mode 2 — Validate RFP against Vendor Proposal
router.post(
  "/validate",
  upload.fields([{ name: "rfp" }, { name: "vendor" }]),
  async (req, res) => {
    try {
      if (!req.files?.rfp?.[0] || !req.files?.vendor?.[0]) {
        return res
          .status(400)
          .json({ success: false, error: "Both RFP and vendor files required" });
      }

      const rfpText = await extractText(req.files["rfp"][0].buffer);
      const vendorText = await extractText(req.files["vendor"][0].buffer);

      // Step 1: Extract requirements from RFP
      const { requirements } = await extractRequirements(rfpText);

      // Step 2: Validate each requirement against proposal
      const validation = await validateRequirements(requirements, vendorText);

      // Step 3: Scan proposal for red flags
      const risks = await analyzeRisks(vendorText);

      res.json({
        success: true,
        data: {
          score: validation.score,
          total: validation.total,
          met: validation.met,
          partial: validation.partial,
          missing: validation.missing,
          results: validation.results,
          redFlags: risks.redFlags,
        },
      });
    } catch (err) {
      console.error("Validate error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;

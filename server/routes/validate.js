import express from "express";
import multer from "multer";
import { extractText } from "../utils/pdfParser.js";
import { extractRequirements } from "../chains/extractionChain.js";
import { validateRequirements } from "../chains/validationChain.js";
import { analyzeRisks } from "../chains/riskChain.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/validate",
  upload.fields([{ name: "rfp" }, { name: "vendor" }]),
  async (req, res) => {
    try {
      // Validate files exist
      if (!req.files?.rfp?.[0] || !req.files?.vendor?.[0]) {
        return res.status(400).json({
          success: false,
          error: "Both RFP and vendor files required",
        });
      }

      // Extract text
      let rfpText = await extractText(req.files["rfp"][0].buffer);
      let vendorText = await extractText(req.files["vendor"][0].buffer);

      // CRITICAL FIX → ensure strings
      rfpText = String(rfpText || "").trim();
      vendorText = String(vendorText || "").trim();

      // Debug (optional)
      console.log("RFP type:", typeof rfpText);
      console.log("Vendor type:", typeof vendorText);

      // Prevent empty input
      if (!rfpText) {
        throw new Error("RFP text extraction failed");
      }

      if (!vendorText) {
        throw new Error("Vendor text extraction failed");
      }

      // Step 1: Extract requirements
      const extractionResult = await extractRequirements(rfpText);

      if (!extractionResult?.requirements) {
        throw new Error("Failed to extract requirements");
      }

      const { requirements } = extractionResult;

      // Step 2: Validate
      const validation = await validateRequirements(requirements, vendorText);

      // Step 3: Risk analysis
      const risks = await analyzeRisks(vendorText);

      // Response
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

      res.status(500).json({
        success: false,
        error: err.message || "Validation failed",
      });
    }
  }
);

export default router;
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Words that end with a period but are NOT sentence endings
const ABBREVIATIONS = new Set([
  "rs", "cl", "no", "mr", "dr", "st", "vs", "ie", "eg",
  "etc", "viz", "sr", "jr", "sec", "fig", "vol", "dept",
  "govt", "corp", "ltd", "inc", "approx", "min", "max",
]);

// Check if a period at position i is a sentence ending
function isSentenceEnd(text, i) {
  if (text[i] !== ".") return false;

  // Get the word before the period
  const before = text.slice(0, i).match(/(\w+)$/);
  if (!before) return false;

  const word = before[1].toLowerCase();

  // Skip abbreviations
  if (ABBREVIATIONS.has(word)) return false;

  // Skip single letters (initials like "U.S.")
  if (word.length === 1) return false;

  // Skip numbers like "2.5" or "1.2.3"
  if (/^\d+$/.test(word)) return false;

  return true;
}

// ─────────────────────────────────────────────
// Main PDF text extractor
// Uses Y-position and font-size data to reconstruct
// proper paragraphs and sentence structure
// ─────────────────────────────────────────────
export const extractText = async (buffer) => {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({
    data: uint8Array,
    // Disable range requests for buffer-based loading
    disableRange: true,
    disableStream: true,
  }).promise;

  const pageTexts = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    // ── Filter out headers and footers ──
    // Headers/footers are typically in the top/bottom 7% of the page
    const headerCutoff = pageHeight * 0.93;
    const footerCutoff = pageHeight * 0.07;

    const mainItems = content.items.filter((item) => {
      const y = item.transform[5];
      return y < headerCutoff && y > footerCutoff && item.str.trim().length > 0;
    });

    if (mainItems.length === 0) continue;

    // ── Group items into lines by Y position ──
    // Items within 3 units of Y are on the same line
    const lines = [];
    let currentLine = [];
    let lastY = null;

    // Sort items top-to-bottom, left-to-right
    const sorted = [...mainItems].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    for (const item of sorted) {
      const y = item.transform[5];

      if (lastY === null || Math.abs(y - lastY) <= 3) {
        currentLine.push(item.str);
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine.join("").trim());
        }
        currentLine = [item.str];
      }
      lastY = y;
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join("").trim());
    }

    // ── Filter junk lines ──
    const cleanLines = lines.filter((line) => {
      if (line.length === 0) return false;
      // Skip standalone page numbers
      if (/^\d+$/.test(line.trim())) return false;
      // Skip document reference codes like "mrfp/app/24.01.2014"
      if (/^[a-z]+\/[a-z]+\/[\d.]+$/i.test(line.trim())) return false;
      // Skip watermarks
      if (/^for official use only$/i.test(line.trim())) return false;
      if (/^confidential$/i.test(line.trim())) return false;
      return true;
    });

    // ── Join lines into paragraphs ──
    // A new paragraph starts when:
    // 1. Previous line ends with a period (sentence end)
    // 2. Current line starts with a capital letter or number
    // 3. There's a large gap between lines (detected via font size heuristic)
    const paragraphs = [];
    let currentPara = [];

    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      const prev = cleanLines[i - 1] || "";

      const prevEndsWithPeriod =
        prev.endsWith(".") && isSentenceEnd(prev, prev.length - 1);
      const currStartsWithCap = /^[A-Z0-9([]/.test(line);

      if (
        currentPara.length > 0 &&
        prevEndsWithPeriod &&
        currStartsWithCap
      ) {
        paragraphs.push(currentPara.join(" ").trim());
        currentPara = [line];
      } else {
        // Check for hyphenated word break across lines: "distribu-\ntion"
        if (prev.endsWith("-")) {
          // Remove hyphen and join with next line directly
          currentPara[currentPara.length - 1] = prev.slice(0, -1);
          currentPara.push(line);
        } else {
          // Normal continuation — join with space
          currentPara.push(line);
        }
      }
    }
    if (currentPara.length > 0) {
      paragraphs.push(currentPara.join(" ").trim());
    }

    pageTexts.push(paragraphs.join("\n\n"));
  }

  const fullText = pageTexts
    .join("\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  console.log(
    `PDF extracted: ${pdf.numPages} pages, ${fullText.length} characters`
  );

  // Return both text and pageCount
  // pageCount is used by extractionChain to detect scanned PDFs
  return { text: fullText, pageCount: pdf.numPages };
};

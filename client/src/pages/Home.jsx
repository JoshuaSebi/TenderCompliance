import { useState } from "react";
import Header from "../components/Header";
import ModeSelector from "../components/ModeSelector";
import UploadZone from "../components/UploadZone";
import StartButton from "../components/StartButton";
import ExtractResults from "./ExtractResults";
import CompareResults from "./CompareResults";
import { extractRequirements, compareDocuments } from "../services/api";

const modeInfo = {
  extract: {
    title: "Extract Requirements",
    description:
      "Upload an RFP document and the system will automatically identify and list every mandatory requirement — grouped by category and ready for review.",
  },
  compare: {
    title: "Compare & Validate",
    description:
      "Upload an RFP alongside a Vendor Proposal. The system will cross-reference both documents and return a compliance score, gap analysis, and risk flags.",
  },
};

export default function Home() {
  const [mode, setMode] = useState("extract");
  const [rfpFile, setRfpFile] = useState(null);
  const [vendorFile, setVendorFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const canStart = mode === "extract" ? !!rfpFile : !!rfpFile && !!vendorFile;

  const handleModeChange = (selected) => {
    setMode(selected);
    setVendorFile(null);
    setResults(null);
    setError(null);
  };

  const handleStart = async () => {
    if (!canStart) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data =
        mode === "extract"
          ? await extractRequirements(rfpFile)
          : await compareDocuments(rfpFile, vendorFile);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setError(null);
    setRfpFile(null);
    setVendorFile(null);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0f" }}>

      {/* Navbar */}
      <div
        className="w-full flex items-center justify-between px-8 py-4"
        style={{ borderBottom: "1px solid #1f1f2e" }}
      >
        <Header />
        <ModeSelector mode={mode} onChange={handleModeChange} />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {!results && (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "#f5f5f5" }}>
                  {modeInfo[mode].title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
                  {modeInfo[mode].description}
                </p>
              </div>

              <div
                className="rounded-2xl p-8 flex flex-col gap-6"
                style={{ backgroundColor: "#111118", border: "1px solid #1f1f2e" }}
              >
                <div className={`grid gap-4 ${mode === "compare" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  <div>
                    {mode === "compare" && (
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6b7280" }}>
                        RFP Document
                      </p>
                    )}
                    <UploadZone file={rfpFile} onFile={setRfpFile} onDelete={() => setRfpFile(null)} inputId="rfpInput" />
                  </div>
                  {mode === "compare" && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6b7280" }}>
                        Vendor Proposal
                      </p>
                      <UploadZone file={vendorFile} onFile={setVendorFile} onDelete={() => setVendorFile(null)} inputId="vendorInput" />
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-400 text-center">{error}</p>
                )}

                <StartButton onClick={handleStart} disabled={!canStart || loading} mode={mode} loading={loading} />
              </div>
            </>
          )}

          {results && mode === "extract" && (
            <ExtractResults data={results} onReset={handleReset} />
          )}

          {results && mode === "compare" && (
            <CompareResults data={results} onReset={handleReset} />
          )}

        </div>
      </div>

    </div>
  );
}
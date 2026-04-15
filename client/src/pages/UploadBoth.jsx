import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileDropZone from "../components/FileDropZone";
import useComplianceStore from "../store/complianceStore";
import { validateDocuments } from "../services/api";

export default function UploadBoth() {
  const navigate = useNavigate();
  const [rfpFile, setRfpFile] = useState(null);
  const [vendorFile, setVendorFile] = useState(null);
  const { setValidationData, setLoading, setError, loading } = useComplianceStore();

  const canStart = !!rfpFile && !!vendorFile;

  const handleValidate = async () => {
    if (!canStart) return;
    setLoading(true);
    setError(null);
    try {
      const data = await validateDocuments(rfpFile, vendorFile);
      setValidationData(data);
      navigate("/compliance");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#06060b" }}>
      {/* Nav */}
      <nav className="w-full flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#6b7280" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f5f5")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
          </svg>
          Back
        </button>
        <span
          className="inline-flex items-center text-xs font-bold uppercase tracking-[0.1em] rounded-full"
          style={{
            backgroundColor: "rgba(168,85,247,0.1)",
            color: "#a78bfa",
            border: "1px solid rgba(168,85,247,0.2)",
            padding: "0.5rem 1rem",
            lineHeight: "1.2",
          }}
        >
          Mode 2 — RFP + Proposal
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl flex flex-col gap-8 animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2" style={{ color: "#f5f5f5" }}>
              Validate Compliance
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
              Upload both the RFP and vendor proposal. AI will cross-reference them for compliance scoring and risk detection.
            </p>
          </div>

          <div className="glass-card flex flex-col mt-6" style={{ padding: "1rem 1.25rem 1.25rem" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "#6b7280", padding: "0.5rem 0" }}
                >
                  RFP Document
                </p>
                <FileDropZone
                  file={rfpFile}
                  onFile={setRfpFile}
                  onRemove={() => setRfpFile(null)}
                />
              </div>
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "#6b7280", padding: "0.5rem 0" }}
                >
                  Vendor Proposal
                </p>
                <FileDropZone
                  file={vendorFile}
                  onFile={setVendorFile}
                  onRemove={() => setVendorFile(null)}
                />
              </div>
            </div>

            {useComplianceStore.getState().error && (
              <p className="text-sm text-center" style={{ color: "#ef4444" }}>
                {useComplianceStore.getState().error}
              </p>
            )}

            <button
              onClick={handleValidate}
              disabled={!canStart || loading}
              className="w-full rounded-xl font-semibold text-sm tracking-wide transition-all duration-200"
              style={{
                marginTop: "0.75rem",
                padding: "0.85rem 1.5rem",
                background: !canStart || loading
                  ? "rgba(17, 17, 24, 0.8)"
                  : "linear-gradient(135deg, #8b5cf6, #a855f7)",
                color: !canStart || loading ? "#4b5563" : "#fff",
                cursor: !canStart || loading ? "not-allowed" : "pointer",
                border: !canStart || loading ? "1px solid #1f1f2e" : "none",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-7.07-3.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
                  </svg>
                  Analyzing Documents...
                </span>
              ) : (
                "Validate Compliance"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

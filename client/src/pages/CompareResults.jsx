import { useNavigate } from "react-router-dom";
import useComplianceStore from "../store/complianceStore";
import RadialComplianceChart from "../components/RadialComplianceChart";

const statusStyles = {
  Met: { bg: "rgba(34, 197, 94, 0.08)", text: "#22c55e", border: "rgba(34, 197, 94, 0.15)" },
  Partial: { bg: "rgba(245, 158, 11, 0.08)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.15)" },
  Missing: { bg: "rgba(239, 68, 68, 0.08)", text: "#ef4444", border: "rgba(239, 68, 68, 0.15)" },
};

const riskStyles = {
  Low: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.08)" },
  Medium: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
  High: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)" },
};

export default function CompareResults() {
  const navigate = useNavigate();
  const { validationData, reset } = useComplianceStore();

  // If no data, show empty state
  if (!validationData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#06060b" }}>
        <div className="text-center animate-fade-in">
          <p className="text-lg font-semibold mb-2" style={{ color: "#f5f5f5" }}>
            No compliance data
          </p>
          <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
            Please upload RFP and proposal documents first.
          </p>
          <button
            onClick={() => navigate("/upload-both")}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #a855f7)", color: "#fff" }}
          >
            Upload Documents
          </button>
        </div>
      </div>
    );
  }

  const { score, total, met, partial, missing, results, redFlags } = validationData;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#06060b" }}>
      {/* Nav */}
      <nav className="w-full flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => { reset(); navigate("/"); }}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#6b7280" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f5f5")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
          </svg>
          Start Over
        </button>
        <span className="text-xs font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full"
          style={{ backgroundColor: "rgba(168,85,247,0.1)", color: "#a78bfa", border: "1px solid rgba(168,85,247,0.2)" }}
        >
          Compliance Report
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-8 py-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#f5f5f5" }}>
              Compliance Report
            </h2>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              {total} requirements analyzed against vendor proposal
            </p>
          </div>

          {/* Radial Chart */}
          <RadialComplianceChart
            score={score}
            total={total}
            met={met}
            partial={partial}
            missing={missing}
          />

          {/* Results Breakdown */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <h3 className="text-sm font-bold" style={{ color: "#f5f5f5" }}>
                Requirement Breakdown
              </h3>
              <div className="flex items-center gap-3">
                {["Met", "Partial", "Missing"].map((status) => {
                  const s = statusStyles[status];
                  const count = results?.filter((r) => r.status === status).length || 0;
                  return (
                    <span key={status} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: s.text }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.text }} />
                      {count} {status}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
              {results?.map((req, idx) => {
                const s = statusStyles[req.status] || statusStyles.Missing;
                return (
                  <div key={req.requirementId || idx} className="px-5 py-4 flex flex-col gap-2.5 hover:bg-white/[0.01] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium flex-1 leading-relaxed" style={{ color: "#d1d5db" }}>
                        {req.requirement}
                      </p>
                      <span
                        className="text-xs px-3 py-1 rounded-lg font-semibold shrink-0"
                        style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                      >
                        {req.status}
                      </span>
                    </div>

                    {req.matchedPassage && (
                      <div
                        className="text-xs leading-relaxed pl-4 py-2 rounded-lg"
                        style={{
                          color: "#9ca3af",
                          borderLeft: `2px solid ${s.text}30`,
                          backgroundColor: "rgba(0,0,0,0.2)",
                        }}
                      >
                        "{req.matchedPassage}"
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <span className="text-xs" style={{ color: "#4b5563" }}>
                        Confidence:{" "}
                        <span
                          className="font-semibold"
                          style={{
                            color:
                              req.confidenceScore >= 75 ? "#22c55e"
                              : req.confidenceScore >= 50 ? "#f59e0b"
                              : "#ef4444",
                          }}
                        >
                          {req.confidenceScore}%
                        </span>
                      </span>
                      {req.category && (
                        <span className="text-xs" style={{ color: "#4b5563" }}>
                          {req.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Red Flags */}
          {redFlags && redFlags.length > 0 && (
            <div className="glass-card overflow-hidden" style={{ borderColor: "rgba(239, 68, 68, 0.15)" }}>
              <div
                className="px-5 py-4 flex items-center gap-2"
                style={{
                  borderBottom: "1px solid rgba(239, 68, 68, 0.1)",
                  backgroundColor: "rgba(239, 68, 68, 0.03)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <h3 className="text-sm font-bold" style={{ color: "#ef4444" }}>
                  Red Flags — {redFlags.length} risk{redFlags.length !== 1 ? "s" : ""} detected
                </h3>
              </div>

              <div className="divide-y" style={{ borderColor: "rgba(239, 68, 68, 0.06)" }}>
                {redFlags.map((flag, i) => {
                  const risk = riskStyles[flag.riskLevel] || riskStyles.Medium;
                  return (
                    <div key={i} className="px-5 py-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-relaxed" style={{ color: "#fca5a5" }}>
                          "{flag.sentence}"
                        </p>
                        <span
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold shrink-0"
                          style={{
                            backgroundColor: risk.bg,
                            color: risk.color,
                            border: `1px solid ${risk.color}25`,
                          }}
                        >
                          {flag.riskLevel}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
                        {flag.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
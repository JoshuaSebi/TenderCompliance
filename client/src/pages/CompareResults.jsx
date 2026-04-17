import { useNavigate } from "react-router-dom";
import useComplianceStore from "../store/complianceStore";
import RadialComplianceChart from "../components/RadialComplianceChart";

const statusStyles = {
  Met: {
    bg: "rgba(34,197,94,0.12)",
    text: "#22c55e",
    border: "rgba(34,197,94,0.25)",
  },
  Partial: {
    bg: "rgba(245,158,11,0.12)",
    text: "#f59e0b",
    border: "rgba(245,158,11,0.25)",
  },
  Missing: {
    bg: "rgba(239,68,68,0.12)",
    text: "#ef4444",
    border: "rgba(239,68,68,0.25)",
  },
};

const riskStyles = {
  Low: { color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  Medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  High: { color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
};

export default function CompareResults() {
  const navigate = useNavigate();
  const { validationData, reset } = useComplianceStore();

  // Empty state
  if (!validationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06060b] px-4">
        <div className="text-center flex flex-col items-center space-y-5 max-w-md">
          <p className="text-xl font-semibold text-white">
            No compliance data
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Please upload RFP and proposal documents first.
          </p>
          <button
            onClick={() => navigate("/upload-both")}
            className="px-6 py-3 rounded-xl text-sl font-semibold text-white transition-all duration-200 hover:scale-[1.02] w-25"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
            }}
          >
            Upload Documents
          </button>
        </div>
      </div>
    );
  }

  const { score, total, met, partial, missing, results, redFlags } =
    validationData;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#06060b" }}
    >
      {/* Nav */}
      <nav
        className="w-full flex items-center justify-between px-8 py-5 h-8"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => {
            reset();
            navigate("/");
          }}
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#6b7280" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f5f5")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Start Over
        </button>

        <span
          className="text-xs font-bold tracking-[0.15em] px-3 py-1.5 rounded-full w-40 text-center"
          style={{
            backgroundColor: "rgba(168,85,247,0.1)",
            color: "#a78bfa",
            border: "1px solid rgba(168,85,247,0.2)",
          }}
        >
          Compliance Report
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-4 sm:px-8 py-10">
        <div className="w-full max-w-4xl flex flex-col gap-8">
          {/* Page Header */}
          <div className="flex flex-col items-center text-center gap-4">
            <div>
              <h2
                className="text-2xl font-bold tracking-tight"
                style={{ color: "#f5f5f5" }}
              >
                Compliance Report
              </h2>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                {total} requirements analyzed against vendor proposal
              </p>
            </div>
          </div>

          {/* Stats Circles */}
          <div className="flex justify-center gap-6">
            {[
              {
                label: "Met",
                count: met,
                color: "#22c55e",
                glow: "rgba(34,197,94,0.15)",
              },
              {
                label: "Partial",
                count: partial,
                color: "#f59e0b",
                glow: "rgba(245,158,11,0.15)",
              },
              {
                label: "Missing",
                count: missing,
                color: "#ef4444",
                glow: "rgba(239,68,68,0.15)",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: `radial-gradient(circle at center, ${stat.glow}, rgba(17,17,24,0.8))`,
                    border: `2px solid ${stat.color}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 20px ${stat.glow}`,
                  }}
                >
                  <span
                    style={{
                      color: stat.color,
                      fontSize: stat.count >= 100 ? "1.25rem" : "1.75rem",
                      fontWeight: 800,
                      lineHeight: 1,
                      textAlign: "center",
                    }}
                  >
                    {stat.count}
                  </span>
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#6b7280" }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
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
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Section Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 24px",
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#f5f5f5",
                  margin: 0,
                }}
              >
                Requirement Breakdown
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                {["Met", "Partial", "Missing"].map((status) => {
                  const s = statusStyles[status];
                  const count =
                    results?.filter((r) => r.status === status).length || 0;
                  return (
                    <span
                      key={status}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: s.text,
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: s.text,
                          display: "inline-block",
                        }}
                      />
                      {count} {status}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            <div>
              {results?.map((req, idx) => {
                const s = statusStyles[req.status] || statusStyles.Missing;
                const isLast = idx === (results?.length || 0) - 1;

                return (
                  <div
                    key={req.requirementId || idx}
                    style={{
                      padding: "18px 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      borderBottom: isLast
                        ? "none"
                        : "1px solid rgba(255,255,255,0.04)",
                      transition: "background 0.15s",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.025)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Requirement + Status */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "16px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          lineHeight: "1.65",
                          color: "#e5e7eb",
                          margin: 0,
                          flex: 1,
                        }}
                      >
                        {req.requirement}
                      </p>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          padding: "5px 12px",
                          borderRadius: "8px",
                          backgroundColor: s.bg,
                          color: s.text,
                          border: `1px solid ${s.border}`,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {req.status}
                      </span>
                    </div>

                    {/* Matched Passage */}
                    {req.matchedPassage && (
                      <div
                        style={{
                          fontSize: "12px",
                          lineHeight: "1.65",
                          color: "#9ca3af",
                          paddingLeft: "16px",
                          paddingTop: "8px",
                          paddingBottom: "8px",
                          borderLeft: `2px solid ${s.text}30`,
                          backgroundColor: "rgba(0,0,0,0.2)",
                          borderRadius: "8px",
                        }}
                      >
                        "{req.matchedPassage}"
                      </div>
                    )}

                    {/* Confidence + Category */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#4b5563",
                        }}
                      >
                        Confidence:{" "}
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              req.confidenceScore >= 75
                                ? "#22c55e"
                                : req.confidenceScore >= 50
                                  ? "#f59e0b"
                                  : "#ef4444",
                          }}
                        >
                          {req.confidenceScore}%
                        </span>
                      </span>
                      {req.category && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#6b7280",
                            background: "rgba(255,255,255,0.04)",
                            padding: "3px 10px",
                            borderRadius: "6px",
                          }}
                        >
                          {req.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty */}
            {(!results || results.length === 0) && (
              <div style={{ padding: "64px 24px", textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "#4b5563", margin: 0 }}>
                  No results to display.
                </p>
              </div>
            )}
          </div>

          {/* Red Flags */}
          {redFlags && redFlags.length > 0 && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              {/* Red Flags Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 24px",
                  background: "rgba(239,68,68,0.03)",
                  borderBottom: "1px solid rgba(239,68,68,0.1)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#ef4444",
                    margin: 0,
                  }}
                >
                  Red Flags — {redFlags.length} risk
                  {redFlags.length !== 1 ? "s" : ""} detected
                </h3>
              </div>

              {/* Red Flags Rows */}
              <div>
                {redFlags.map((flag, i) => {
                  const risk = riskStyles[flag.riskLevel] || riskStyles.Medium;
                  const isLast = i === redFlags.length - 1;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: "18px 24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid rgba(239,68,68,0.06)",
                        transition: "background 0.15s",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(239,68,68,0.02)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "16px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 500,
                            lineHeight: "1.65",
                            color: "#fca5a5",
                            margin: 0,
                            flex: 1,
                          }}
                        >
                          "{flag.sentence}"
                        </p>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            padding: "5px 12px",
                            borderRadius: "8px",
                            backgroundColor: risk.bg,
                            color: risk.color,
                            border: `1px solid ${risk.color}25`,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {flag.riskLevel}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          lineHeight: "1.65",
                          color: "#6b7280",
                          margin: 0,
                        }}
                      >
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
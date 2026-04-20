import { useNavigate } from "react-router-dom";
import useComplianceStore from "../store/complianceStore";
import CategoryFilter from "../components/CategoryFilter";
import RequirementsTable from "../components/RequirementsTable";

function exportToCSV(requirements) {
  const headers = ["ID", "Category", "Requirement", "Keyword"];
  const rows = requirements.map((r) => [
    r.id,
    r.category,
    `"${r.text.replace(/"/g, '""')}"`,
    r.keyword,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "requirements.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function ChecklistView() {
  const navigate = useNavigate();
  const { requirements, unsureRequirements, activeFilter, reset } = useComplianceStore();

  const filtered =
    activeFilter === "All"
      ? requirements
      : requirements.filter((r) => r.category === activeFilter);

  const categoryCount = Object.keys(
    requirements.reduce((a, r) => ({ ...a, [r.category]: true }), {})
  ).length;

  if (requirements.length === 0) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06060b] px-4">
      
      <div className="text-center flex flex-col items-center space-y-5 max-w-md">
        
        {/* Title */}
        <p className="text-xl font-semibold text-white">
          No requirements found
        </p>

        {/* Subtitle */}
        <p className="text-sm text-gray-400 leading-relaxed">
          Please upload an RFP document first.
        </p>

        {/* Button */}
        <button
          onClick={() => navigate("/upload-rfp")}
          className="px-6 py-3 rounded-xl text-sl font-semibold text-white transition-all duration-200 hover:scale-[1.02] w-25"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          }}
        >
          Upload RFP
        </button>

      </div>
    </div>
  );
}

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
          className="text-xs font-bold tracking-[0.15em] px-3 py-1.5 rounded-full w-35 text-center"
          style={{
            backgroundColor: "rgba(99,102,241,0.1)",
            color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          Checklist View
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
                Extracted Requirements
              </h2>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                {requirements.length} requirements found across {categoryCount}{" "}
                {categoryCount === 1 ? "category" : "categories"}
              </p>
            </div>

            {/* Export Button */}
            <button
              onClick={() => exportToCSV(requirements)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: "rgba(17,17,24,0.8)",
                color: "#9ca3af",
                border: "1px solid rgba(31,31,46,0.5)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
                e.currentTarget.style.color = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(31,31,46,0.5)";
                e.currentTarget.style.color = "#9ca3af";
              }}
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex justify-center">
            <CategoryFilter />
          </div>

          {/* Stats Circles */}
          <div className="flex justify-center gap-6">
            {[
              {
                label: "Technical",
                count: requirements.filter((r) => r.category === "Technical").length,
                color: "#60a5fa",
                glow: "rgba(96,165,250,0.15)",
              },
              {
                label: "Legal",
                count: requirements.filter((r) => r.category === "Legal").length,
                color: "#c084fc",
                glow: "rgba(192,132,252,0.15)",
              },
              {
                label: "Financial",
                count: requirements.filter((r) => r.category === "Financial").length,
                color: "#34d399",
                glow: "rgba(52,211,153,0.15)",
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

          {/* Requirements Table */}
          <RequirementsTable filtered={filtered} />

          {/* Unsure Requirements Table */}
          {unsureRequirements && unsureRequirements.length > 0 && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              {/* Unsure Section Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 24px",
                  background: "rgba(245,158,11,0.03)",
                  borderBottom: "1px solid rgba(245,158,11,0.1)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#f59e0b",
                    margin: 0,
                  }}
                >
                  Unsure Requirements — {unsureRequirements.length} item
                  {unsureRequirements.length !== 1 ? "s" : ""} need review
                </h3>
              </div>

              {/* Unsure description */}
              <div
                style={{
                  padding: "10px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: "1.65",
                    color: "#6b7280",
                    margin: 0,
                  }}
                >
                  These requirements were extracted but the AI could not fully
                  verify them against the source document. Please review
                  manually.
                </p>
              </div>

              {/* Reuse RequirementsTable for unsure items */}
              <RequirementsTable filtered={unsureRequirements} noWrapper />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

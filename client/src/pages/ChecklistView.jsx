import { useNavigate } from "react-router-dom";
import useComplianceStore from "../store/complianceStore";
import CategoryFilter from "../components/CategoryFilter";

const categoryColors = {
  Technical: { bg: "rgba(96, 165, 250, 0.08)", text: "#60a5fa", border: "rgba(96, 165, 250, 0.2)" },
  Legal: { bg: "rgba(192, 132, 252, 0.08)", text: "#c084fc", border: "rgba(192, 132, 252, 0.2)" },
  Financial: { bg: "rgba(52, 211, 153, 0.08)", text: "#34d399", border: "rgba(52, 211, 153, 0.2)" },
};

const keywordStyles = {
  shall: "#f59e0b",
  must: "#ef4444",
  required: "#60a5fa",
  mandatory: "#c084fc",
};

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
  const { requirements, activeFilter, reset } = useComplianceStore();

  const filtered =
    activeFilter === "All"
      ? requirements
      : requirements.filter((r) => r.category === activeFilter);

  if (requirements.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#06060b" }}>
        <div className="text-center animate-fade-in">
          <p className="text-lg font-semibold mb-2" style={{ color: "#f5f5f5" }}>
            No requirements found
          </p>
          <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
            Please upload an RFP document first.
          </p>
          <button
            onClick={() => navigate("/upload-rfp")}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}
          >
            Upload RFP
          </button>
        </div>
      </div>
    );
  }

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
          style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          Checklist View
        </span>
      </nav>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-8 py-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-6 animate-fade-in-up">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#f5f5f5" }}>
                Extracted Requirements
              </h2>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                {requirements.length} requirements found across {Object.keys(
                  requirements.reduce((a, r) => ({ ...a, [r.category]: true }), {})
                ).length} categories
              </p>
            </div>
            <button
              id="export-csv-btn"
              onClick={() => exportToCSV(requirements)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: "rgba(17, 17, 24, 0.8)",
                color: "#9ca3af",
                border: "1px solid rgba(31, 31, 46, 0.5)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
                e.currentTarget.style.color = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(31, 31, 46, 0.5)";
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Filters */}
          <CategoryFilter />

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Technical", count: requirements.filter(r => r.category === "Technical").length, color: "#60a5fa" },
              { label: "Legal", count: requirements.filter(r => r.category === "Legal").length, color: "#c084fc" },
              { label: "Financial", count: requirements.filter(r => r.category === "Financial").length, color: "#34d399" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.count}</p>
                <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Requirements Table */}
          <div className="glass-card overflow-hidden">
            {/* Table Header */}
            <div
              className="grid grid-cols-[60px_1fr_100px_90px] sm:grid-cols-[60px_1fr_120px_100px] px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#4b5563", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span>#</span>
              <span>Requirement</span>
              <span>Category</span>
              <span>Keyword</span>
            </div>

            {/* Table Rows */}
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
              {filtered.map((req, idx) => {
                const catColors = categoryColors[req.category] || categoryColors.Technical;
                const kwColor = keywordStyles[req.keyword] || "#6b7280";

                return (
                  <div
                    key={req.id}
                    className="grid grid-cols-[60px_1fr_100px_90px] sm:grid-cols-[60px_1fr_120px_100px] px-5 py-4 items-start hover:bg-white/[0.01] transition-colors"
                    style={{ animationDelay: `${idx * 0.02}s` }}
                  >
                    <span className="text-xs font-mono pt-0.5" style={{ color: "#4b5563" }}>
                      {req.id}
                    </span>
                    <p className="text-sm leading-relaxed pr-4" style={{ color: "#d1d5db" }}>
                      {req.text}
                    </p>
                    <span
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold w-fit"
                      style={{
                        backgroundColor: catColors.bg,
                        color: catColors.text,
                        border: `1px solid ${catColors.border}`,
                      }}
                    >
                      {req.category}
                    </span>
                    <span
                      className="text-xs font-semibold uppercase tracking-wide pt-0.5"
                      style={{ color: kwColor }}
                    >
                      {req.keyword}
                    </span>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-sm" style={{ color: "#4b5563" }}>
                  No requirements match the selected filter.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";

const categoryColors = {
  Technical: { bg: "#0d1a2a", text: "#60a5fa", border: "#1e3a5f" },
  Legal: { bg: "#1a0d2a", text: "#c084fc", border: "#3b1f5e" },
  Financial: { bg: "#0d2a1a", text: "#34d399", border: "#1a4d35" },
  General: { bg: "#1a1a0d", text: "#fbbf24", border: "#4d4020" },
};

const categoryPillStyle = {
  Technical: { backgroundColor: "#1e3a5f", color: "#60a5fa" },
  Legal:     { backgroundColor: "#3b1f5e", color: "#c084fc" },
  Financial: { backgroundColor: "#1a4d35", color: "#34d399" },
  General:   { backgroundColor: "#4d4020", color: "#fbbf24" },
};

const keywordColor = "#6b7280";
const CATEGORIES = ["All", "Technical", "Financial", "Legal", "General"];

export default function ExtractResults({ data, onReset }) {
  const { requirements } = data;
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? requirements
    : requirements.filter((r) => r.category === activeFilter);

  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === "All"
      ? requirements.length
      : requirements.filter((r) => r.category === cat).length;
    return acc;
  }, {});

  const grouped = filtered.reduce((acc, req) => {
    const cat = req.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(req);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: "#f5f5f5" }}>
            Extracted Requirements
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
            {requirements.length} requirements found
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm px-4 py-2 rounded-lg transition-all"
          style={{ backgroundColor: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#22222e"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1a1a24"}
        >
          Start Over
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeFilter === cat;
          const colors = categoryColors[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-all"
              style={{
                backgroundColor: isActive
                  ? cat === "All" ? "#2a2a3a" : colors.bg
                  : "#111118",
                color: isActive
                  ? cat === "All" ? "#f5f5f5" : colors.text
                  : "#6b7280",
                border: isActive
                  ? `1px solid ${cat === "All" ? "#3a3a4a" : colors.border}`
                  : "1px solid #1f1f2e",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {cat}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: isActive
                    ? cat === "All" ? "#3a3a4a" : "#0a0a0f"
                    : "#1a1a24",
                  color: isActive
                    ? cat === "All" ? "#f5f5f5" : colors.text
                    : "#4b5563",
                }}
              >
                {counts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {Object.keys(grouped).length === 0 ? (
        <div
          className="text-sm text-center py-12 rounded-2xl"
          style={{ color: "#6b7280", border: "1px solid #1f1f2e" }}
        >
          No requirements in this category
        </div>
      ) : (
        Object.entries(grouped).map(([category, reqs]) => {
          const colors = categoryColors[category] || categoryColors.General;
          return (
            <div
              key={category}
              className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${colors.border}`, backgroundColor: "#111118" }}
            >
              {/* Category header */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ backgroundColor: colors.bg, borderBottom: `1px solid ${colors.border}` }}
              >
                <span className="text-sm font-semibold" style={{ color: colors.text }}>
                  {category}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: "#0a0a0f", color: colors.text }}
                >
                  {reqs.length}
                </span>
              </div>

              {/* Requirements list */}
              <div className="divide-y" style={{ borderColor: "#1f1f2e" }}>
                {reqs.map((req) => (
                  <div key={req.id} className="px-5 py-4 flex items-start gap-3">
                    <span
                      className="text-xs font-mono mt-0.5 shrink-0"
                      style={{ color: keywordColor }}
                    >
                      #{req.id}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>
                        {req.text}
                      </p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                          style={categoryPillStyle[req.category] || categoryPillStyle.General}
                        >
                          {req.category}
                        </span>
                        {req.keyword && (
                          <span
                            className="inline-block text-xs px-2 py-0.5 rounded font-medium uppercase tracking-wide"
                            style={{ backgroundColor: "#1a1a24", color: "#6b7280" }}
                          >
                            {req.keyword}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
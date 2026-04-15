const categoryColors = {
  Technical: { bg: "#0d1a2a", text: "#60a5fa", border: "#1e3a5f" },
  Legal: { bg: "#1a0d2a", text: "#c084fc", border: "#3b1f5e" },
  Financial: { bg: "#0d2a1a", text: "#34d399", border: "#1a4d35" },
  General: { bg: "#1a1a0d", text: "#fbbf24", border: "#4d4020" },
};

const keywordColor = "#6b7280";

export default function ExtractResults({ data, onReset }) {
  const { requirements } = data;

  const grouped = requirements.reduce((acc, req) => {
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

      {/* Categories */}
      {Object.entries(grouped).map(([category, reqs]) => {
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
                    {req.keyword && (
                      <span
                        className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded font-medium uppercase tracking-wide"
                        style={{ backgroundColor: "#1a1a24", color: "#6b7280" }}
                      >
                        {req.keyword}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

    </div>
  );
}
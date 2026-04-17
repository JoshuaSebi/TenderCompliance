const categoryColors = {
  Technical: {
    bg: "rgba(99,102,241,0.12)",
    text: "#818cf8",
    border: "rgba(99,102,241,0.25)",
  },
  Legal: {
    bg: "rgba(167,139,250,0.12)",
    text: "#a78bfa",
    border: "rgba(167,139,250,0.25)",
  },
  Financial: {
    bg: "rgba(52,211,153,0.12)",
    text: "#34d399",
    border: "rgba(52,211,153,0.25)",
  },
};

const keywordStyles = {
  MUST: "#f87171",
  SHALL: "#fb923c",
  REQUIRED: "#facc15",
  SHOULD: "#60a5fa",
  MAY: "#34d399",
};

export default function RequirementsTable({ filtered }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "56px 1fr 130px 110px",
          padding: "12px 24px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {["#", "Requirement", "Category", "Keyword"].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#374151",
              textAlign: i === 0 || i >= 2 ? "center" : "left",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {filtered.map((req, idx) => {
          const catColors =
            categoryColors[req.category] || categoryColors.Technical;
          const kwColor = keywordStyles[req.keyword?.toUpperCase()] || "#6b7280";
          const isLast = idx === filtered.length - 1;

          return (
            <div
              key={req.id}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr 130px 110px",
                padding: "18px 24px",
                alignItems: "center",
                borderBottom: isLast
                  ? "none"
                  : "1px solid rgba(255,255,255,0.04)",
                transition: "background 0.15s",
                cursor: "default",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.025)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {/* Index */}
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: "#374151",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "6px",
                  padding: "3px 0",
                  width: "32px",
                  margin: "0 auto",
                  display: "block",
                }}
              >
                {String(req.id).padStart(2, "0")}
              </span>

              {/* Requirement Text */}
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: "1.65",
                  color: "#e5e7eb",
                  margin: 0,
                  paddingRight: "24px",
                }}
              >
                {req.text}
              </p>

              {/* Category Badge */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    backgroundColor: catColors.bg,
                    color: catColors.text,
                    border: `1px solid ${catColors.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {req.category}
                </span>
              </div>

              {/* Keyword */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: kwColor,
                    background: `${kwColor}14`,
                    border: `1px solid ${kwColor}30`,
                    borderRadius: "6px",
                    padding: "5px 10px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {req.keyword}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div style={{ padding: "64px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4b5563"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p style={{ fontSize: "14px", color: "#4b5563", margin: 0 }}>
            No requirements match the selected filter.
          </p>
        </div>
      )}
    </div>
  );
}

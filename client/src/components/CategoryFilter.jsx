import useComplianceStore from "../store/complianceStore";

const categories = ["All", "Technical", "Legal", "Financial","General"];

export default function CategoryFilter() {
  const { activeFilter, setActiveFilter, requirements } = useComplianceStore();

  const getCounts = (cat) => {
    if (cat === "All") return requirements.length;
    return requirements.filter((r) => r.category === cat).length;
  };

  return (
    <div className="flex justify-center">
      {/* Container */}
      <div
        className="flex border border-white/10 rounded-full p-1 gap-1"
        style={{ backgroundColor: "#0f0f17" }}
      >
        {categories.map((cat) => {
          const isActive = activeFilter === cat;
          const count = getCounts(cat);

          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className="flex items-center gap-2 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                padding: "6px 16px",
                whiteSpace: "nowrap",
                backgroundColor: isActive ? "#1a1a2e" : "transparent",
                color: isActive ? "#818cf8" : "#9ca3af",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "#9ca3af";
              }}
            >
              {/* Label */}
              <span>{cat}</span>

              {/* Badge */}
              <span
                className="text-xs font-semibold rounded-full"
                style={{
                  padding: "2px 8px",
                  minWidth: "22px",
                  textAlign: "center",
                  display: "inline-block",
                  backgroundColor: isActive
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.06)",
                  color: isActive ? "#818cf8" : "#6b7280",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
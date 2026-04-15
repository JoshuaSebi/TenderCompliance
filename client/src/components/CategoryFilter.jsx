import useComplianceStore from "../store/complianceStore";

const categories = ["All", "Technical", "Legal", "Financial"];

const categoryStyles = {
  All: { active: "#818cf8", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.2)" },
  Technical: { active: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)", border: "rgba(96, 165, 250, 0.2)" },
  Legal: { active: "#c084fc", bg: "rgba(192, 132, 252, 0.1)", border: "rgba(192, 132, 252, 0.2)" },
  Financial: { active: "#34d399", bg: "rgba(52, 211, 153, 0.1)", border: "rgba(52, 211, 153, 0.2)" },
};

export default function CategoryFilter() {
  const { activeFilter, setActiveFilter, requirements } = useComplianceStore();

  const getCounts = (cat) => {
    if (cat === "All") return requirements.length;
    return requirements.filter((r) => r.category === cat).length;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const isActive = activeFilter === cat;
        const style = categoryStyles[cat];
        const count = getCounts(cat);

        return (
          <button
            key={cat}
            id={`filter-${cat.toLowerCase()}`}
            onClick={() => setActiveFilter(cat)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: isActive ? style.bg : "rgba(17, 17, 24, 0.5)",
              color: isActive ? style.active : "#6b7280",
              border: `1px solid ${isActive ? style.border : "rgba(31, 31, 46, 0.5)"}`,
            }}
          >
            {cat}
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
              style={{
                backgroundColor: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.03)",
                color: isActive ? style.active : "#4b5563",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

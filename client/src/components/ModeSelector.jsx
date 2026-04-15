const modes = [
  { id: "extract", label: "Extract" },
  { id: "compare", label: "Compare" },
];

export default function ModeSelector({ mode, onChange }) {
  return (
    <div
      className="flex rounded-lg p-1 gap-1"
      style={{ backgroundColor: "#1a1a24", border: "1px solid #2a2a3a" }}
    >
      {modes.map((m) => {
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className="px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150"
            style={{
              backgroundColor: isActive ? "#e8f4fd" : "transparent",
              color: isActive ? "#0a0a0f" : "#6b7280",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
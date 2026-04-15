export default function StartButton({ onClick, disabled, mode, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-150"
      style={{
        backgroundColor: disabled ? "#1a1a24" : "#e8f4fd",
        color: disabled ? "#4b5563" : "#0a0a0f",
        cursor: disabled ? "not-allowed" : "pointer",
        border: disabled ? "1px solid #2a2a3a" : "none",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#d0eaf8"; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#e8f4fd"; }}
    >
      {loading
        ? "Processing..."
        : mode === "extract"
        ? "Extract Requirements"
        : "Compare and Validate"}
    </button>
  );
}
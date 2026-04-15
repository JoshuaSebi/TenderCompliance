import { useState, useRef } from "react";

export default function FileDropZone({ file, onFile, onRemove, label }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      onFile(dropped);
    }
  };

  const handleClick = () => {
    if (!file) inputRef.current?.click();
  };

  const handleChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFile(selected);
  };

  return (
    <div className="relative animate-fade-in">
      {label && (
        <p
          className="text-xs font-semibold uppercase tracking-[0.15em] mb-3"
          style={{ color: "#6b7280" }}
        >
          {label}
        </p>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className="rounded-2xl transition-all duration-300 relative overflow-hidden"
        style={{
          border: `2px dashed ${
            dragging ? "#6366f1" : file ? "#22c55e" : "#1f1f2e"
          }`,
          backgroundColor: dragging
            ? "rgba(99, 102, 241, 0.05)"
            : file
            ? "rgba(34, 197, 94, 0.03)"
            : "rgba(17, 17, 24, 0.5)",
          cursor: file ? "default" : "pointer",
          minHeight: "140px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        {/* Shimmer overlay on drag */}
        {dragging && (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(99,102,241,0.1), transparent)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        )}

        {file ? (
          <div className="flex items-center gap-4 z-10">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, #14532d, #166534)",
                color: "#22c55e",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              PDF
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: "#f5f5f5" }}>
                {file.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                {(file.size / 1024).toFixed(1)} KB — Ready
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center z-10">
            <div className="mb-3 mx-auto w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.15)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "#9ca3af" }}>
              Drag & drop or{" "}
              <span style={{ color: "#818cf8" }}>browse</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "#4b5563" }}>
              PDF files only
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Remove button */}
      {file && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            top: label ? "2.2rem" : "0.75rem",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
          }}
          title="Remove file"
        >
          ✕
        </button>
      )}
    </div>
  );
}

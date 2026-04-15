import { useState } from "react";

export default function UploadZone({ file, onFile, onDelete, inputId }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div className="relative">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && document.getElementById(inputId).click()}
        className="rounded-xl p-10 text-center transition-all duration-200"
        style={{
          border: `2px dashed ${dragging ? "#60a5fa" : file ? "#22c55e" : "#2a2a3a"}`,
          backgroundColor: dragging ? "#0d1a2a" : file ? "#0a1a0f" : "#0d0d14",
          cursor: file ? "default" : "pointer",
          minHeight: "140px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "#14532d", color: "#22c55e" }}
            >
              PDF
            </div>
            <div className="text-left">
              <p className="text-sm font-medium" style={{ color: "#f5f5f5" }}>
                {file.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium" style={{ color: "#9ca3af" }}>
              Drag and drop or click to upload
            </p>
            <p className="text-xs mt-1" style={{ color: "#4b5563" }}>PDF files only</p>
          </div>
        )}

        <input
          id={inputId}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        />
      </div>

      {file && (
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-150"
          style={{ backgroundColor: "#2a1a1a", color: "#ef4444" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#3d1a1a"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#2a1a1a"}
          title="Remove file"
        >
          x
        </button>
      )}
    </div>
  );
}
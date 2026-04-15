import { useNavigate } from "react-router-dom";

const modes = [
  {
    id: "rfp-only",
    route: "/upload-rfp",
    title: "RFP Only",
    subtitle: "Extract Requirements",
    description:
      "Upload an RFP document and let AI automatically identify every mandatory requirement — categorized, keyword-tagged and ready for review.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    accentColor: "#818cf8",
    tag: "Mode 1",
  },
  {
    id: "rfp-proposal",
    route: "/upload-both",
    title: "RFP + Proposal",
    subtitle: "Validate Compliance",
    description:
      "Upload both the RFP and vendor proposal. AI cross-references them to deliver a compliance score, gap analysis, and risk flags.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
        <path d="M15 3v4a2 2 0 0 0 2 2h4" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
    accentColor: "#a78bfa",
    tag: "Mode 2",
  },
];

const features = [
  { color: "#f59e0b", text: "AI-Powered Extraction" },
  { color: "#10b981", text: "Compliance Scoring" },
  { color: "#ef4444", text: "Risk Detection" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#06060b" }}
    >
      {/* Navigation */}
      <nav
        className="w-full flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 12 2 2 4-4" />
              <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9" />
            </svg>
          </div>
          <h1
            className="text-base font-bold tracking-tight"
            style={{ color: "#f5f5f5" }}
          >
            Tender Compliance
          </h1>
        </div>

        <div
          className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
          style={{
            backgroundColor: "rgba(99,102,241,0.1)",
            color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          AI-Powered
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-10">

        {/* Title Block */}
        <div style={{ maxWidth: "640px", width: "100%" }}>
          <p
            className="text-xs font-bold uppercase mb-4 text-center"
            style={{ color: "#818cf8", letterSpacing: "0.2em" }}
          >
            Procurement Intelligence
          </p>
          <h2
            className="font-extrabold tracking-tight leading-tight mb-4 text-center"
            style={{
              color: "#f5f5f5",
              fontSize: "clamp(24px, 3.8vw, 42px)",
              whiteSpace: "nowrap",
            }}
          >
            Analyze RFPs with{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #818cf8, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI Precision
            </span>
          </h2>
          <p
            className="text-base leading-relaxed mx-auto text-center w-full"
            style={{ color: "#6b7280", maxWidth: "480px", margin: "0 auto"}}
          >
            Extract mandatory requirements, validate vendor proposals and identify compliance risks.
          </p>
        </div>

        {/* Mode Cards */}
        <div
          className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5"
          style={{ maxWidth: "720px" }}
        >
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => navigate(mode.route)}
              className="text-left flex flex-col gap-5 group cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "28px",
                transition: "background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase"
                  style={{
                    letterSpacing: "0.15em",
                    padding: "5px 10px",
                    borderRadius: "999px",
                    backgroundColor: `${mode.accentColor}18`,
                    color: mode.accentColor,
                    border: `1px solid ${mode.accentColor}30`,
                  }}
                >
                  {mode.tag}
                </span>

                <div
                  className="transition-opacity"
                  style={{
                    color: mode.accentColor,
                    opacity: 0.6,
                  }}
                >
                  {mode.icon}
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-col gap-1.5">
                <h3
                  className="font-bold"
                  style={{ fontSize: "20px", color: "#f5f5f5", letterSpacing: "-0.01em" }}
                >
                  {mode.title}
                </h3>
                <p
                  className="text-sm font-semibold"
                  style={{ color: mode.accentColor }}
                >
                  {mode.subtitle}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#6b7280", marginTop: "4px" }}
                >
                  {mode.description}
                </p>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <span
                  className="text-sm font-semibold"
                  style={{ color: mode.accentColor }}
                >
                  Get Started
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={mode.accentColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-hover:translate-x-1 transition-transform"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Features Strip */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          {features.map((feature) => (
            <div key={feature.text} className="flex items-center gap-2">
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: feature.color,
                  flexShrink: 0,
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: "#4b5563" }}
              >
                {feature.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    gradient: "from-indigo-500/20 to-blue-500/10",
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
        <path d="M15 3v4a2 2 0 0 0 2 2h4" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
    gradient: "from-purple-500/20 to-pink-500/10",
    accentColor: "#a78bfa",
    tag: "Mode 2",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#06060b" }}>
      {/* Navigation */}
      <nav
        className="w-full flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 12 2 2 4-4" />
              <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight" style={{ color: "#f5f5f5" }}>
              Tender Compliance
            </h1>
          </div>
        </div>
        <div
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          AI-Powered
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-3xl flex flex-col items-center gap-10">
          {/* Title */}
          <div className="text-center animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
              style={{ color: "#818cf8" }}
            >
              Procurement Intelligence
            </p>
            <h2
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4"
              style={{ color: "#f5f5f5" }}
            >
              Analyze RFPs with{" "}
              <span className="gradient-text">AI Precision</span>
            </h2>
            <p
              className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
              style={{ color: "#6b7280" }}
            >
              Extract mandatory requirements, validate vendor proposals and identify compliance risks.
            </p>
          </div>

          {/* Mode Cards */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5">
            {modes.map((mode, index) => (
              <button
                key={mode.id}
                id={`mode-card-${mode.id}`}
                onClick={() => navigate(mode.route)}
                className="glass-card glass-card-hover text-left p-7 flex flex-col gap-5 animate-fade-in-up group cursor-pointer"
                style={{ animationDelay: `${0.2 + index * 0.1}s`, opacity: 0 }}
              >
                {/* Tag */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: `${mode.accentColor}15`,
                      color: mode.accentColor,
                      border: `1px solid ${mode.accentColor}30`,
                    }}
                  >
                    {mode.tag}
                  </span>
                  <div style={{ color: mode.accentColor }} className="opacity-60 group-hover:opacity-100 transition-opacity">
                    {mode.icon}
                  </div>
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-xl font-bold mb-1" style={{ color: "#f5f5f5" }}>
                    {mode.title}
                  </h3>
                  <p className="text-sm font-medium mb-2" style={{ color: mode.accentColor }}>
                    {mode.subtitle}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>
                    {mode.description}
                  </p>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 mt-auto">
                  <span className="text-sm font-semibold" style={{ color: mode.accentColor }}>
                    Get Started
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={mode.accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
          <div
            className="flex flex-wrap items-center justify-center gap-6 animate-fade-in-up"
            style={{ animationDelay: "0.5s", opacity: 0 }}
          >
            {[
              { icon: "⚡", text: "AI-Powered Extraction" },
              { icon: "🎯", text: "Compliance Scoring" },
              { icon: "🚩", text: "Risk Detection" },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-2">
                <span className="text-sm">{feature.icon}</span>
                <span className="text-xs font-medium" style={{ color: "#4b5563" }}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

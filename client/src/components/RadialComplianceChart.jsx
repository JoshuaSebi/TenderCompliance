import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { useState, useEffect } from "react";

function AnimatedNumber({ value, duration = 1200 }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let startTime = null;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{current}</>;
}

function getScoreColor(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function getScoreGradient(score) {
  if (score >= 75) return ["#22c55e", "#16a34a"];
  if (score >= 50) return ["#f59e0b", "#d97706"];
  return ["#ef4444", "#dc2626"];
}

function getScoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 25) return "Poor";
  return "Critical";
}

export default function RadialComplianceChart({ score, total, met, partial, missing }) {
  const color = getScoreColor(score);
  const [gradientStart, gradientEnd] = getScoreGradient(score);
  const label = getScoreLabel(score);

  const chartData = [
    {
      name: "Compliance",
      value: score,
      fill: `url(#scoreGradient)`,
    },
  ];

  const statCards = [
    {
      label: "Total",
      value: total,
      color: "#818cf8",
      bg: "rgba(99, 102, 241, 0.08)",
      border: "rgba(99, 102, 241, 0.15)",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
      ),
    },
    {
      label: "Met",
      value: met,
      color: "#22c55e",
      bg: "rgba(34, 197, 94, 0.08)",
      border: "rgba(34, 197, 94, 0.15)",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 12 2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
    {
      label: "Missing",
      value: missing,
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.08)",
      border: "rgba(239, 68, 68, 0.15)",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="glass-card p-6 sm:p-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Radial Chart */}
        <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              data={chartData}
              barSize={14}
            >
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={gradientStart} />
                  <stop offset="100%" stopColor={gradientEnd} />
                </linearGradient>
              </defs>
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background={{ fill: "rgba(255,255,255,0.03)" }}
                clockWise
                dataKey="value"
                cornerRadius={10}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold" style={{ color }}>
              <AnimatedNumber value={score} />%
            </span>
            <span className="text-xs font-semibold mt-0.5" style={{ color: "#6b7280" }}>
              {label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 w-full">
          <h3 className="text-lg font-bold mb-1" style={{ color: "#f5f5f5" }}>
            Compliance Score
          </h3>
          <p className="text-sm mb-5" style={{ color: "#6b7280" }}>
            {met} of {total} requirements fully met
            {partial > 0 && `, ${partial} partially met`}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4 text-center transition-all duration-200"
                style={{
                  backgroundColor: stat.bg,
                  border: `1px solid ${stat.border}`,
                }}
              >
                <div className="flex justify-center mb-2" style={{ color: stat.color }}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>
                  <AnimatedNumber value={stat.value} duration={800} />
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: "#6b7280" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

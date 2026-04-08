"use client";

import { motion } from "framer-motion";

interface SignalMeterProps {
  signal: string;
  score: number; // 0–10
}

const SIGNAL_LABELS = ["STRONG SELL", "SELL", "HOLD", "BUY", "STRONG BUY"];
const SIGNAL_COLORS = ["#E74C3C", "#E67E22", "#F39C12", "#27AE60", "#2ECC71"];

export function SignalMeter({ signal, score }: SignalMeterProps) {
  // Clamp score to 0-10
  const clampedScore = Math.min(10, Math.max(0, score));
  // Map to 0-180 degrees (left to right semicircle)
  const angle = (clampedScore / 10) * 180;
  // Map to color index (0-4)
  const colorIdx = Math.min(4, Math.floor(clampedScore / 2));
  const color = SIGNAL_COLORS[colorIdx];

  const width = 260;
  const height = 150;
  const centerX = width / 2;
  const centerY = height - 10;
  const radius = 100;

  // Needle tip position
  const needleAngle = (180 - angle) * (Math.PI / 180);
  const needleX = centerX + radius * 0.82 * Math.cos(needleAngle);
  const needleY = centerY - radius * 0.82 * Math.sin(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background arcs — 5 segments */}
        {SIGNAL_COLORS.map((c, i) => {
          const startAngle = 180 - i * 36;
          const endAngle = startAngle - 36;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const x1 = centerX + radius * Math.cos(startRad);
          const y1 = centerY - radius * Math.sin(startRad);
          const x2 = centerX + radius * Math.cos(endRad);
          const y2 = centerY - radius * Math.sin(endRad);

          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 0 ${x2} ${y2}`}
              fill="none"
              stroke={c}
              strokeWidth="14"
              strokeLinecap="round"
              opacity={0.25}
            />
          );
        })}

        {/* Active arc up to needle */}
        {angle > 0 && (
          <motion.path
            d={(() => {
              const startRad = Math.PI;
              const endRad = (180 - angle) * (Math.PI / 180);
              const x1 = centerX + radius * Math.cos(startRad);
              const y1 = centerY - radius * Math.sin(startRad);
              const x2 = centerX + radius * Math.cos(endRad);
              const y2 = centerY - radius * Math.sin(endRad);
              const largeArc = angle > 180 ? 1 : 0;
              return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
            })()}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        )}

        {/* Needle */}
        <motion.line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ x2: centerX - radius * 0.82, y2: centerY }}
          animate={{ x2: needleX, y2: needleY }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="6" fill={color} />
        <circle cx={centerX} cy={centerY} r="3" fill="var(--color-surface)" />

        {/* Labels */}
        {SIGNAL_LABELS.map((label, i) => {
          const labelAngle = (180 - i * 36 - 18) * (Math.PI / 180);
          const lx = centerX + (radius + 22) * Math.cos(labelAngle);
          const ly = centerY - (radius + 22) * Math.sin(labelAngle);
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize="7"
              fontWeight="600"
              fill={SIGNAL_COLORS[i]}
              opacity={colorIdx === i ? 1 : 0.4}
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Signal text */}
      <div className="mt-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-bold uppercase" style={{ color }}>
            {signal.replace("_", " ")}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
          Score: {clampedScore.toFixed(1)} / 10
        </p>
      </div>
    </div>
  );
}

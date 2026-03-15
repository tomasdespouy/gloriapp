"use client";

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
  color?: string;
}

export default function TrendChart({ data, height = 200, color = "#4A55A2" }: Props) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 10);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;

  const padding = { top: 20, right: 16, bottom: 32, left: 36 };
  const chartW = 100; // percentage-based via viewBox
  const chartH = height;
  const innerW = chartW - padding.left - padding.right;
  const innerH = chartH - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: padding.top + innerH - ((d.value - minVal) / range) * innerH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Area fill
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  // Y-axis gridlines
  const gridLines = [0, 2.5, 5, 7.5, 10].filter((v) => v >= minVal && v <= maxVal);

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      {/* Grid lines */}
      {gridLines.map((val) => {
        const y = padding.top + innerH - ((val - minVal) / range) * innerH;
        return (
          <g key={val}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + innerW}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={0.3}
              strokeDasharray="1,1"
            />
            <text
              x={padding.left - 3}
              y={y + 1}
              textAnchor="end"
              fill="#9CA3AF"
              fontSize={3}
              dominantBaseline="middle"
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill={color} opacity={0.08} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={1.2} fill="white" stroke={color} strokeWidth={0.5} />
          {/* Value label */}
          <text
            x={p.x}
            y={p.y - 3}
            textAnchor="middle"
            fill={color}
            fontSize={2.5}
            fontWeight="600"
          >
            {p.value.toFixed(1)}
          </text>
          {/* X-axis label */}
          <text
            x={p.x}
            y={padding.top + innerH + 6}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize={2.2}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

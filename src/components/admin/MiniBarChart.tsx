"use client";

type MiniBarChartProps = {
  data: number[];
  maxValue?: number;
  color?: string;
  height?: number;
};

export default function MiniBarChart({
  data,
  maxValue,
  color = "#4A55A2",
  height = 24,
}: MiniBarChartProps) {
  const max = maxValue ?? Math.max(...data, 1);

  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((val, i) => (
        <div
          key={i}
          className="rounded-sm flex-1 min-w-[3px]"
          style={{
            height: `${(val / max) * 100}%`,
            backgroundColor: color,
            opacity: 0.7 + (val / max) * 0.3,
          }}
        />
      ))}
    </div>
  );
}

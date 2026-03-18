"use client";

interface Props {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export default function GloriaSpinner({ text, size = "md" }: Props) {
  const sizes = {
    sm: { container: 40, logo: 12, orbit: 18, dot: 3, textSize: "text-[10px]" },
    md: { container: 64, logo: 16, orbit: 28, dot: 4, textSize: "text-xs" },
    lg: { container: 96, logo: 24, orbit: 42, dot: 6, textSize: "text-sm" },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: s.container, height: s.container }}>
        {/* Orbit track */}
        <div
          className="absolute inset-0 rounded-full border border-sidebar/10"
          style={{ margin: (s.container - s.orbit * 2) / 2 }}
        />

        {/* Orbiting dot with trail */}
        <div
          className="absolute inset-0 animate-[gloria-orbit_1.8s_linear_infinite]"
        >
          <div
            className="absolute rounded-full bg-sidebar shadow-[0_0_8px_rgba(74,85,162,0.5)]"
            style={{
              width: s.dot,
              height: s.dot,
              top: (s.container / 2) - s.orbit - (s.dot / 2),
              left: (s.container / 2) - (s.dot / 2),
            }}
          />
        </div>

        {/* Trail dot 1 (delayed) */}
        <div
          className="absolute inset-0 animate-[gloria-orbit_1.8s_linear_infinite] opacity-40"
          style={{ animationDelay: "-0.15s" }}
        >
          <div
            className="absolute rounded-full bg-sidebar/60"
            style={{
              width: s.dot * 0.7,
              height: s.dot * 0.7,
              top: (s.container / 2) - s.orbit - (s.dot * 0.7 / 2),
              left: (s.container / 2) - (s.dot * 0.7 / 2),
            }}
          />
        </div>

        {/* Trail dot 2 (more delayed) */}
        <div
          className="absolute inset-0 animate-[gloria-orbit_1.8s_linear_infinite] opacity-20"
          style={{ animationDelay: "-0.3s" }}
        >
          <div
            className="absolute rounded-full bg-sidebar/40"
            style={{
              width: s.dot * 0.4,
              height: s.dot * 0.4,
              top: (s.container / 2) - s.orbit - (s.dot * 0.4 / 2),
              left: (s.container / 2) - (s.dot * 0.4 / 2),
            }}
          />
        </div>

        {/* Center logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/icon.png"
            alt=""
            style={{ width: s.logo, height: s.logo }}
            className="opacity-80"
          />
        </div>
      </div>

      {text && (
        <p className={`${s.textSize} text-gray-500 animate-pulse`}>{text}</p>
      )}
    </div>
  );
}

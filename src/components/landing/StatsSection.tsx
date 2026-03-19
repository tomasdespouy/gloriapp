"use client";

import { useEffect, useRef, useState } from "react";
import ScrollReveal from "./ScrollReveal";

interface StatsSectionProps {
  patients?: number;
  sessions?: number;
  countries?: number;
}

function buildStats(props: StatsSectionProps) {
  return [
    { value: props.patients || 34, suffix: "+", label: "Pacientes IA disponibles", prefix: "" },
    { value: props.sessions || 0, suffix: "+", label: "Sesiones realizadas", prefix: "" },
    { value: props.countries || 7, suffix: "", label: "Pa\u00edses representados", prefix: "" },
    { value: 10, suffix: "", label: "Competencias evaluadas", prefix: "" },
  ];
}

function useCountUp(target: number, isVisible: boolean, duration = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return count;
}

function StatItem({
  value,
  suffix,
  prefix,
  label,
  isVisible,
}: {
  value: number;
  suffix: string;
  prefix: string;
  label: string;
  isVisible: boolean;
}) {
  const count = useCountUp(value, isVisible);

  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-bold text-[#4A55A2]">
        {prefix}
        {count}
        {suffix}
      </p>
      <p className="text-gray-600 mt-1 text-sm">{label}</p>
    </div>
  );
}

export default function StatsSection(props: StatsSectionProps) {
  const stats = buildStats(props);
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-white py-10 lg:py-14" ref={ref}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10">
            {stats.map((stat) => (
              <StatItem key={stat.label} {...stat} isVisible={isVisible} />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { COMPETENCY_INFO } from "@/lib/competency-definitions";

export default function CompetencyTooltip({ compKey }: { compKey: string }) {
  const [show, setShow] = useState(false);
  const info = COMPETENCY_INFO[compKey];
  if (!info) return null;

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-sidebar/10 text-sidebar inline-flex items-center justify-center text-[9px] font-bold hover:bg-sidebar/20 transition-colors cursor-help"
      >
        i
      </span>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2.5 shadow-lg pointer-events-auto">
          <p className="font-bold mb-1">{info.name}</p>
          <p className="text-white/80 mb-2">{info.definition}</p>
          <Link
            href={info.learnLink}
            className="text-[10px] text-blue-300 hover:text-blue-200 underline"
          >
            Ver nano curso →
          </Link>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
}

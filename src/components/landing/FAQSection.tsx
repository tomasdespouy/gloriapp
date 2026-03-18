"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQSectionProps {
  dict: Record<string, string>;
}

export default function FAQSection({ dict }: FAQSectionProps) {
  const t = (key: string) => dict[key] || key;
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const FAQS = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
    { q: t("faq.q7"), a: t("faq.a7") },
    { q: t("faq.q8"), a: t("faq.a8") },
    { q: t("faq.q9"), a: t("faq.a9") },
    { q: t("faq.q10"), a: t("faq.a10") },
  ];

  return (
    <section className="bg-[#FAFAFA] py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            {t("faq.title")}
          </h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            {t("faq.subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    openIdx === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIdx === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

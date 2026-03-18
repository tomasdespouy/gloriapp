"use client";

import { Check, X, Minus } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

interface ComparisonSectionProps {
  dict: Record<string, string>;
}

function Icon({ type }: { type: string }) {
  if (type === "check") return <Check size={16} className="text-green-500" />;
  if (type === "x") return <X size={16} className="text-red-400" />;
  return <Minus size={16} className="text-amber-400" />;
}

export default function ComparisonSection({ dict }: ComparisonSectionProps) {
  const t = (key: string) => dict[key] || key;
  const ROWS = [
    { feature: t("comparison.row1Feature"), traditional: t("comparison.row1Traditional"), gloria: t("comparison.row1Gloria"), tradIcon: "minus", gloriaIcon: "check" },
    { feature: t("comparison.row2Feature"), traditional: t("comparison.row2Traditional"), gloria: t("comparison.row2Gloria"), tradIcon: "minus", gloriaIcon: "check" },
    { feature: t("comparison.row3Feature"), traditional: t("comparison.row3Traditional"), gloria: t("comparison.row3Gloria"), tradIcon: "x", gloriaIcon: "check" },
    { feature: t("comparison.row4Feature"), traditional: t("comparison.row4Traditional"), gloria: t("comparison.row4Gloria"), tradIcon: "x", gloriaIcon: "check" },
    { feature: t("comparison.row5Feature"), traditional: t("comparison.row5Traditional"), gloria: t("comparison.row5Gloria"), tradIcon: "x", gloriaIcon: "check" },
    { feature: t("comparison.row6Feature"), traditional: t("comparison.row6Traditional"), gloria: t("comparison.row6Gloria"), tradIcon: "minus", gloriaIcon: "check" },
    { feature: t("comparison.row7Feature"), traditional: t("comparison.row7Traditional"), gloria: t("comparison.row7Gloria"), tradIcon: "x", gloriaIcon: "check" },
    { feature: t("comparison.row8Feature"), traditional: t("comparison.row8Traditional"), gloria: t("comparison.row8Gloria"), tradIcon: "minus", gloriaIcon: "check" },
    { feature: t("comparison.row9Feature"), traditional: t("comparison.row9Traditional"), gloria: t("comparison.row9Gloria"), tradIcon: "check", gloriaIcon: "minus" },
    { feature: t("comparison.row10Feature"), traditional: t("comparison.row10Traditional"), gloria: t("comparison.row10Gloria"), tradIcon: "check", gloriaIcon: "check" },
  ];

  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              {t("comparison.title")}
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              {t("comparison.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 w-[35%]"></th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 w-[32.5%]">{t("comparison.headerTraditional")}</th>
                  <th className="text-left py-3 px-4 font-bold text-sidebar w-[32.5%]">{t("comparison.headerGloria")}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900 text-xs">{row.feature}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0"><Icon type={row.tradIcon} /></span>
                        <span>{row.traditional}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0"><Icon type={row.gloriaIcon} /></span>
                        <span>{row.gloria}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-6">
            {t("comparison.footnote")}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

import type { LucideIcon } from "lucide-react";

type KPICardProps = {
  icon: LucideIcon;
  value: string | number;
  label: string;
  delta?: string;
  color?: string;
};

export default function KPICard({ icon: Icon, value, label, delta, color = "blue" }: KPICardProps) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-500" },
    green: { bg: "bg-green-50", text: "text-green-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-500" },
    purple: { bg: "bg-purple-50", text: "text-purple-500" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-500" },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full ${c.bg} flex items-center justify-center`}>
        <Icon size={20} className={c.text} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {delta && (
          <p className={`text-[10px] mt-0.5 ${delta.startsWith("+") ? "text-green-500" : "text-red-500"}`}>
            {delta}
          </p>
        )}
      </div>
    </div>
  );
}

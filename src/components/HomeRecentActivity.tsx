import Link from "next/link";
import { Clock, MessageSquare, BookOpen, Check } from "lucide-react";

export type ActivityItem = {
  kind: "session_completed" | "feedback_received" | "capsule_completed";
  title: string;
  subtitle: string;
  badge?: { label: string; tone: "good" | "neutral" } | null;
};

type Props = {
  items: ActivityItem[];
};

const ICON_BY_KIND: Record<ActivityItem["kind"], React.ComponentType<{ size?: number; className?: string }>> = {
  session_completed: Check,
  feedback_received: MessageSquare,
  capsule_completed: BookOpen,
};

const ICON_TONE_BY_KIND: Record<ActivityItem["kind"], string> = {
  session_completed: "bg-emerald-50 text-emerald-600",
  feedback_received: "bg-sidebar/10 text-sidebar",
  capsule_completed: "bg-amber-50 text-amber-600",
};

export default function HomeRecentActivity({ items }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Actividad reciente</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 px-1 py-3">
          Aún no tienes actividad. Cuando completes una sesión, aparecerá aquí.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, i) => {
            const Icon = ICON_BY_KIND[item.kind];
            const tone = ICON_TONE_BY_KIND[item.kind];
            const badgeColor =
              item.badge?.tone === "good"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-600";
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
                <div className={`w-9 h-9 rounded-full ${tone} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium leading-tight">
                    {item.subtitle.split(" · ")[0]}
                  </p>
                  <p className="text-sm font-medium text-gray-900 leading-tight mt-0.5 truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-gray-400">
                      {item.subtitle.split(" · ").slice(1).join(" · ") || ""}
                    </p>
                    {item.badge && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>
                        {item.badge.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <Link
          href="/historial"
          className="block text-center text-xs text-sidebar hover:underline mt-4"
        >
          Ir a historial →
        </Link>
      )}
    </div>
  );
}

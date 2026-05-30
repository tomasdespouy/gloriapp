import Link from "next/link";
import { Play, BookOpen, Target, ChevronRight, Flag } from "lucide-react";

export type NextStep = {
  kind: "active_session" | "next_capsule" | "weekly_goal";
  title: string;
  subtitle: string;
  href: string;
};

type Props = {
  steps: NextStep[];
};

const ICON_BY_KIND: Record<NextStep["kind"], React.ComponentType<{ size?: number; className?: string }>> = {
  active_session: Play,
  next_capsule: BookOpen,
  weekly_goal: Target,
};

const ACCENT_BY_KIND: Record<NextStep["kind"], string> = {
  active_session: "bg-sidebar/10 text-sidebar",
  next_capsule: "bg-emerald-500/10 text-emerald-600",
  weekly_goal: "bg-amber-500/10 text-amber-600",
};

export default function HomeNextSteps({ steps }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Flag size={14} className="text-sidebar" />
        <h2 className="text-sm font-semibold text-gray-900">Tus próximos pasos</h2>
      </div>

      <div className="space-y-2.5">
        {steps.length === 0 ? (
          <p className="text-xs text-gray-400 px-1">
            Estás al día. Explora un paciente o una cápsula nueva cuando quieras.
          </p>
        ) : (
          steps.map((step, i) => {
            const Icon = ICON_BY_KIND[step.kind];
            const accent = ACCENT_BY_KIND[step.kind];
            return (
              <Link
                key={i}
                href={step.href}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-sidebar/30 hover:bg-gray-50 transition-all group"
              >
                <div className={`w-11 h-11 rounded-full ${accent} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium leading-tight">
                    {step.subtitle}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5 truncate">
                    {step.title}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-sidebar transition-colors flex-shrink-0" />
              </Link>
            );
          })
        )}
      </div>

      {steps.length > 0 && (
        <Link
          href="/aprendizaje"
          className="block text-center text-xs text-sidebar hover:underline mt-4"
        >
          Ver plan de aprendizaje completo →
        </Link>
      )}
    </div>
  );
}

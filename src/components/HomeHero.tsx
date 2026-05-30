import Link from "next/link";
import { Play, BookOpen, Clock, MessageCircle, Hourglass, Library } from "lucide-react";

type Props = {
  firstName: string;
  daysSinceLastVisit: number | null; // null = no previous visits (first time)
  sessionsCount: number;
  totalMinutes: number;
  capsulesReady: number;
  primaryCta: { href: string; label: string };
};

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

function MetricChip({ icon: Icon, value, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{value}</p>
        <p className="text-[10.5px] text-white/75 leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

export default function HomeHero({
  firstName,
  daysSinceLastVisit,
  sessionsCount,
  totalMinutes,
  capsulesReady,
  primaryCta,
}: Props) {
  const daysLabel =
    daysSinceLastVisit === null
      ? { value: "Bienvenida", label: "Tu primera sesión" }
      : daysSinceLastVisit === 0
      ? { value: "Hoy", label: "Ya practicaste hoy" }
      : {
          value: `${daysSinceLastVisit} ${daysSinceLastVisit === 1 ? "día" : "días"}`,
          label: "desde tu último ingreso",
        };

  return (
    <section className="relative rounded-2xl overflow-hidden h-[320px] sm:h-[340px] shadow-sm">
      {/* Background image — psicóloga + paciente alineados a la derecha */}
      <div
        className="absolute inset-0 bg-no-repeat bg-cover"
        style={{
          backgroundImage: "url(/branding/banner.png)",
          backgroundPosition: "right center",
        }}
        aria-hidden
      />
      {/* Overlay degradado izquierda → centro para legibilidad del texto.
          La derecha queda limpia para que se vea la imagen completa. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(45, 53, 97, 0.92) 0%, rgba(45, 53, 97, 0.78) 35%, rgba(45, 53, 97, 0.35) 60%, rgba(45, 53, 97, 0) 80%)",
        }}
        aria-hidden
      />

      {/* Contenido */}
      <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
        {/* Top: saludo + CTAs */}
        <div className="max-w-[520px]">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            ¡Hola, {firstName}!
          </h1>
          <p className="text-sm sm:text-base text-white/85 mt-1.5 max-w-md">
            Continúa fortaleciendo tu escucha clínica.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-2 bg-white text-[#2D3561] px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm cursor-pointer"
            >
              <Play size={15} fill="currentColor" />
              {primaryCta.label}
            </Link>
            <Link
              href="/aprendizaje"
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/25 transition-colors cursor-pointer"
            >
              <BookOpen size={15} />
              Mi plan de aprendizaje
            </Link>
          </div>
        </div>

        {/* Bottom: métricas. Línea sutil sobre el degradado las separa del saludo */}
        <div>
          <div className="border-t border-white/15 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 max-w-[680px]">
            <MetricChip icon={Clock} value={daysLabel.value} label={daysLabel.label} />
            <MetricChip
              icon={MessageCircle}
              value={`${sessionsCount}`}
              label={sessionsCount === 1 ? "sesión realizada" : "sesiones realizadas"}
            />
            <MetricChip
              icon={Hourglass}
              value={formatMinutes(totalMinutes)}
              label="en plataforma"
            />
            <MetricChip
              icon={Library}
              value={`${capsulesReady}`}
              label={capsulesReady === 1 ? "cápsula lista para ti" : "cápsulas listas para ti"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

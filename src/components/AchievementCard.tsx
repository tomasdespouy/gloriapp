"use client";

const emojiMap: Record<string, string> = {
  heart: "❤️",
  star: "⭐",
  trophy: "🏆",
  sparkles: "✨",
  flame: "🔥",
  fire: "🔥",
  "book-open": "📖",
  "check-circle": "✅",
  zap: "⚡",
  award: "🏅",
  ear: "👂",
  handshake: "🤝",
};

interface Props {
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
  isNew?: boolean;
}

export default function AchievementCard({ name, description, icon, earned, earnedAt, isNew }: Props) {
  const emoji = emojiMap[icon] || "⭐";

  if (!earned) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 opacity-50">
        <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl grayscale">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-400 truncate">{name}</p>
          <p className="text-xs text-gray-300 truncate">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
        isNew
          ? "bg-gradient-to-r from-sidebar/5 to-purple-50 border-sidebar/30 animate-glow"
          : "bg-white border-gray-200 hover:border-sidebar/20 hover:shadow-sm"
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${
        isNew ? "bg-gradient-to-br from-sidebar to-purple-500 shadow-md" : "bg-gradient-to-br from-amber-50 to-orange-50"
      }`}>
        <span className={isNew ? "animate-pop" : ""}>{emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          {isNew && (
            <span className="text-[9px] font-bold text-white bg-sidebar px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
              Nuevo
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{description}</p>
        {earnedAt && (
          <p className="text-[10px] text-sidebar/60 mt-0.5">
            {new Date(earnedAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>
    </div>
  );
}

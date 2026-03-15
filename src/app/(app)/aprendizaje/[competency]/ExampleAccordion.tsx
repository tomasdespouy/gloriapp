"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Lightbulb, Lock, CheckCircle2, Star, Play } from "lucide-react";
import type { LearningExample, DialogueLine } from "@/lib/learning-data";

interface Props {
  examples: LearningExample[];
  competencyKey: string;
  readExampleIds: string[];
}

export default function ExampleAccordion({ examples, competencyKey, readExampleIds }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set(readExampleIds));
  const [xpToast, setXpToast] = useState<string | null>(null);

  const isUnlocked = (idx: number) => {
    if (idx === 0) return true;
    return readIds.has(examples[idx - 1].id);
  };

  const markAsRead = async (exampleId: string) => {
    if (readIds.has(exampleId)) return;

    const res = await fetch("/api/learning/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ example_id: exampleId, competency: competencyKey }),
    });

    if (res.ok) {
      setReadIds((prev) => new Set([...prev, exampleId]));
      setXpToast("+10 XP");
      setTimeout(() => setXpToast(null), 2000);
    }
  };

  const totalRead = examples.filter((ex) => readIds.has(ex.id)).length;
  const progressPct = Math.round((totalRead / examples.length) * 100);

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-sidebar h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
          {totalRead}/{examples.length} completados
        </span>
      </div>

      {/* XP toast */}
      {xpToast && (
        <div className="fixed top-6 right-6 z-50 bg-sidebar text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <Star size={16} className="text-yellow-300" />
          <span className="text-sm font-bold">{xpToast}</span>
        </div>
      )}

      {examples.map((ex, idx) => {
        const isOpen = openId === ex.id;
        const unlocked = isUnlocked(idx);
        const isRead = readIds.has(ex.id);

        return (
          <div
            key={ex.id}
            className={`bg-white rounded-xl border overflow-hidden transition-all ${
              isOpen ? "border-sidebar/30 shadow-sm" : "border-gray-200"
            } ${!unlocked ? "opacity-60" : ""}`}
          >
            {/* Header */}
            <button
              onClick={() => {
                if (!unlocked) return;
                setOpenId(isOpen ? null : ex.id);
              }}
              className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${
                unlocked ? "hover:bg-gray-50 cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isRead
                  ? "bg-green-100 text-green-600"
                  : unlocked
                  ? "bg-sidebar/10 text-sidebar"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {isRead ? (
                  <CheckCircle2 size={16} />
                ) : unlocked ? (
                  idx + 1
                ) : (
                  <Lock size={14} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${unlocked ? "text-gray-900" : "text-gray-400"}`}>
                  {unlocked ? ex.title : "Completa el ejemplo anterior para desbloquear"}
                </p>
                {unlocked && (
                  <p className="text-xs text-gray-500 truncate">{ex.context}</p>
                )}
              </div>
              {unlocked && (
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform flex-shrink-0 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {/* Body */}
            {isOpen && unlocked && (
              <div className="px-5 pb-5 space-y-4 animate-fade-in">
                {/* Context */}
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Contexto
                  </p>
                  <p className="text-sm text-gray-700">{ex.context}</p>
                </div>

                {/* Dialogue — starts only on click */}
                <AnimatedDialogue key={ex.id} dialogue={ex.dialogue} />

                {/* Explanation */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Por qué funciona
                  </p>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {ex.explanation}
                  </p>
                </div>

                {/* Tip */}
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                  <Lightbulb size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                      Tip práctico
                    </p>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      {ex.tip}
                    </p>
                  </div>
                </div>

                {/* Mark as read button */}
                {!isRead && (
                  <button
                    onClick={() => markAsRead(ex.id)}
                    className="w-full bg-sidebar text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    Marcar como leído (+10 XP)
                  </button>
                )}

                {isRead && (
                  <div className="flex items-center gap-2 justify-center text-green-600 text-sm">
                    <CheckCircle2 size={16} />
                    <span className="font-medium">Completado</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══ ANIMATED DIALOGUE — Click to start, slower typing ═══

function AnimatedDialogue({ dialogue }: { dialogue: DialogueLine[] }) {
  const [started, setStarted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charRef = useRef(0);

  // Slower: 1 char per tick at 45ms = ~22 chars/sec (was 2 chars per 25ms = ~80 chars/sec)
  const CHAR_PER_TICK = 1;
  const TICK_MS = 45;
  const PAUSE_BEFORE = 700;  // pause before typing starts
  const PAUSE_BETWEEN = 1200; // pause between messages

  const typeMessage = useCallback((text: string, onDone: () => void) => {
    setTyping(true);
    setDisplayedText("");
    charRef.current = 0;

    const tick = () => {
      charRef.current += CHAR_PER_TICK;
      setDisplayedText(text.slice(0, charRef.current));
      if (charRef.current < text.length) {
        timerRef.current = setTimeout(tick, TICK_MS);
      } else {
        setTyping(false);
        onDone();
      }
    };
    timerRef.current = setTimeout(tick, PAUSE_BEFORE);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (visibleCount < dialogue.length) {
      const nextLine = dialogue[visibleCount];
      typeMessage(nextLine.content, () => { // eslint-disable-line react-hooks/set-state-in-effect
        timerRef.current = setTimeout(() => {
          setVisibleCount((v) => v + 1);
        }, PAUSE_BETWEEN);
      });
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visibleCount, dialogue, typeMessage, started]);

  // Not started yet — show play button
  if (!started) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diálogo</p>
        <button
          onClick={() => { setStarted(true); setVisibleCount(0); }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-sidebar/5 hover:bg-sidebar/10 border border-sidebar/20 rounded-xl transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={18} className="text-white ml-0.5" />
          </div>
          <span className="text-sm font-medium text-sidebar">Iniciar caso clínico</span>
        </button>
        <p className="text-[10px] text-gray-400 text-center">{dialogue.length} turnos de conversación</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diálogo</p>

      {dialogue.map((line, i) => {
        if (i > visibleCount) return null;
        const isCurrentlyTyping = i === visibleCount && typing;
        const content = isCurrentlyTyping ? displayedText : (i < visibleCount ? line.content : "");

        if (!content && !isCurrentlyTyping) return null;

        return (
          <div key={i} className={`flex ${line.role === "therapist" ? "justify-end" : "justify-start"} ${i === visibleCount ? "animate-msg-left" : ""}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              line.role === "therapist"
                ? "bg-sidebar text-white rounded-br-md"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
            }`}>
              <p className="text-[10px] font-medium opacity-70 mb-0.5">
                {line.role === "therapist" ? "Terapeuta" : "Paciente"}
              </p>
              {content}
              {isCurrentlyTyping && <span className="animate-pulse">|</span>}
            </div>
          </div>
        );
      })}

      {/* Thinking indicator */}
      {started && visibleCount < dialogue.length && !typing && (
        <div className={`flex ${dialogue[visibleCount].role === "therapist" ? "justify-end" : "justify-start"}`}>
          <div className={`px-4 py-2.5 rounded-2xl text-xs ${
            dialogue[visibleCount].role === "therapist"
              ? "bg-sidebar/20 text-sidebar"
              : "bg-gray-100 text-gray-400"
          }`}>
            {dialogue[visibleCount].role === "therapist" ? "Terapeuta" : "Paciente"} está pensando
            <span className="inline-flex gap-0.5 ml-1">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </span>
          </div>
        </div>
      )}

      {/* Completed indicator */}
      {visibleCount >= dialogue.length && !typing && (
        <div className="text-center py-2">
          <p className="text-[10px] text-gray-400">Diálogo completo</p>
        </div>
      )}
    </div>
  );
}

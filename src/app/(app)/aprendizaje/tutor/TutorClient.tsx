"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, GraduationCap, CheckCircle2,
  Sparkles, BookOpen, Mic, MicOff,
} from "lucide-react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
  hint?: string;
};

type Phase = "welcome" | "select" | "practice" | "feedback";

const COMP_EMOJIS: Record<string, string> = {
  setting_terapeutico: "\uD83C\uDFE0",
  motivo_consulta: "\uD83D\uDD0D",
  datos_contextuales: "\uD83D\uDCCB",
  objetivos: "\uD83C\uDFAF",
  escucha_activa: "\uD83D\uDC42",
  actitud_no_valorativa: "\uD83E\uDEC6",
  optimismo: "\uD83C\uDF31",
  presencia: "\uD83E\uDDD8",
  conducta_no_verbal: "\uD83E\uDD32",
  contencion_afectos: "\uD83E\uDEC2",
};

const COMP_DESCRIPTIONS: Record<string, string> = {
  setting_terapeutico: "Explicitar encuadre, confidencialidad y roles",
  motivo_consulta: "Indagar motivo manifiesto y latente, explorar recursos",
  datos_contextuales: "Integrar contextos familiares, laborales y culturales",
  objetivos: "Co-construir metas terap\u00e9uticas con el paciente",
  escucha_activa: "Atender lo verbal y no verbal con respuesta congruente",
  actitud_no_valorativa: "Aceptaci\u00f3n incondicional sin juicios",
  optimismo: "Transmitir esperanza integrada con intervenciones t\u00e9cnicas",
  presencia: "Atenci\u00f3n sostenida, flexibilidad y sinton\u00eda",
  conducta_no_verbal: "Leer e integrar se\u00f1ales corporales del paciente",
  contencion_afectos: "Sostener emociones intensas con calidez y empat\u00eda",
};

const GLORIA_AVATAR = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/patients/gloria-avatar.jpg`;

export default function TutorClient({
  competencies,
  firstName = "Estudiante",
}: {
  competencies: { key: string; label: string }[];
  firstName?: string;
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [selectedComps, setSelectedComps] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const msgCountRef = useRef(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
  }, [messages]);

  // Shift hold to record
  useEffect(() => {
    if (phase !== "practice") return;
    const down = (e: KeyboardEvent) => { if (e.key === "Shift" && !e.repeat && !isRecording && !isStreaming) startRecording(); };
    const up = (e: KeyboardEvent) => { if (e.key === "Shift" && isRecording) stopRecording(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase, isRecording, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = input;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setInput(finalTranscript + interim);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setIsRecording(false); };

  const toggleComp = (key: string) => {
    setSelectedComps((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const startPractice = async () => {
    const comps = selectedComps.length > 0 ? selectedComps : competencies.map((c) => c.key);
    if (comps.length > 0 && selectedComps.length === 0) setSelectedComps(comps);
    setTransitioning(false);
    setPhase("practice");
    setIsStreaming(true);
    msgCountRef.current = 0;

    const res = await fetch("/api/learning/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", competencies: selectedComps }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages([{ role: "assistant", content: data.message, hint: data.hint }]);
    }
    setIsStreaming(false);
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    const newMsg: Message = { role: "user", content: trimmed };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setIsStreaming(true);
    msgCountRef.current++;

    const apiMessages = updated.map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("/api/learning/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "respond",
        competencies: selectedComps,
        messages: apiMessages,
        turnCount: msgCountRef.current,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const assistantMsg: Message = { role: "assistant", content: data.message, hint: data.hint };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.feedback) {
        setFeedback(data.feedback);
        setPhase("feedback");
        fetch("/api/learning/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ example_id: "tutor-session", competency: "tutor" }),
        }).catch(() => {});
      }
    }
    setIsStreaming(false);
  };

  const requestFeedback = async () => {
    setIsStreaming(true);
    const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch("/api/learning/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback", competencies: selectedComps, messages: apiMessages }),
    });
    if (res.ok) {
      const data = await res.json();
      setFeedback(data.feedback);
      setPhase("feedback");
      fetch("/api/learning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ example_id: "tutor-session", competency: "tutor" }),
      }).catch(() => {});
    }
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const compLabels = selectedComps
    .map((k) => competencies.find((c) => c.key === k)?.label)
    .filter(Boolean);

  // ═════════════════════════════════════════════
  // WELCOME PHASE
  // ═════════════════════════════════════════════
  // Hide sidebar when in welcome/select phase (full-screen onboarding)
  useEffect(() => {
    if (phase === "welcome" || phase === "select") {
      document.querySelector("aside")?.classList.add("!hidden");
      document.querySelector(".md\\:ml-\\[260px\\]")?.classList.add("!ml-0");
      // Also hide mobile hamburger
      const hamburger = document.querySelector("[aria-label='Abrir men\u00fa']") as HTMLElement;
      if (hamburger) hamburger.style.display = "none";
    }
    return () => {
      document.querySelector("aside")?.classList.remove("!hidden");
      document.querySelector(".md\\:ml-\\[260px\\]")?.classList.remove("!ml-0");
      const hamburger = document.querySelector("[aria-label='Abrir men\u00fa']") as HTMLElement;
      if (hamburger) hamburger.style.display = "";
    };
  }, [phase]);

  if (phase === "welcome") {
    return (
      <div className={`min-h-screen chat-pattern transition-opacity duration-500 ${transitioning ? "opacity-0" : "opacity-100"}`}>
        <div className="px-4 sm:px-8 pb-12 pt-12 max-w-2xl mx-auto">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GLORIA_AVATAR} alt="GlorIA" className="w-32 h-32 rounded-full object-cover mx-auto mb-6 shadow-lg border-4 border-white" />
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{`\u00a1Hola ${firstName}!`}</h1>
            <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
              {"Soy GlorIA, tu tutora en esta plataforma de entrenamiento cl\u00ednico. Te voy a guiar paso a paso para que te sientas con confianza antes de practicar con pacientes simulados."}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-sidebar">1</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{"Sesi\u00f3n conmigo"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{"Primero vamos a practicar con un paciente ficticio. Yo te dar\u00e9 retroalimentaci\u00f3n en tiempo real para que vayas aprendiendo."}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-sidebar">2</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Aprendizaje por competencias</p>
                <p className="text-xs text-gray-500 mt-0.5">{"Despu\u00e9s de nuestra sesi\u00f3n, se desbloquear\u00e1n 10 m\u00f3dulos con ejemplos de di\u00e1logos terap\u00e9uticos para seguir mejorando."}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-sidebar">3</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{"Pr\u00e1ctica con pacientes IA"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{"Finalmente, podr\u00e1s conversar con pacientes simulados que tienen historias y personalidades \u00fanicas. Tu docente revisar\u00e1 tu desempe\u00f1o."}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                setTransitioning(true);
                setTimeout(() => { setPhase("select"); setTransitioning(false); }, 400);
              }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-sidebar to-[#354080] text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 active:bg-green-500 transition-all duration-300"
            >
              <Sparkles size={24} />
            </button>
            <p className="text-xs text-gray-400">Comenzar</p>
            <button
              onClick={() => {
                setSelectedComps(competencies.map((c) => c.key));
                // Mark as SKIPPED, not completed. This still creates a
                // learning_progress row so the dashboard does not redirect
                // back here on every navigation, but the example_id is
                // distinct so the /aprendizaje listing does not show the
                // tutor card as "Completado".
                fetch("/api/learning/progress", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ example_id: "tutor-skipped", competency: "tutor" }),
                }).then(() => window.location.href = "/dashboard");
              }}
              className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline mt-2"
            >
              {"Omitir introducci\u00f3n"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════
  // SELECTION PHASE — patient intro + start
  // ═════════════════════════════════════════════
  if (phase === "select") {
    const MARTIN_IMG = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/patients/martin-lagos.png`;
    return (
      <div className={`min-h-screen chat-pattern transition-opacity duration-500 ${transitioning ? "opacity-0" : "opacity-100"}`}>
        <div className="px-4 sm:px-8 pb-12 pt-8 max-w-lg mx-auto">
          {/* GlorIA avatar at top */}
          <div className="text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GLORIA_AVATAR} alt="GlorIA" className="w-14 h-14 rounded-full object-cover mx-auto mb-3 shadow-md border-2 border-white" />
            <p className="text-xs text-gray-500">{"Vas a practicar con este paciente. Yo te guiar\u00e9 en tiempo real."}</p>
          </div>

          {/* Patient card — large photo + student photo */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-center gap-6 mb-4">
              {/* Patient */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={MARTIN_IMG} alt={"Mart\u00edn Lagos"} className="w-full h-full object-cover" />
                </div>
                <p className="text-sm font-medium text-gray-700">{"Mart\u00edn Lagos"}</p>
                <p className="text-[11px] text-gray-500">{"32 a\u00f1os, Dise\u00f1ador"}</p>
              </div>

              <div className="w-10 h-px bg-gray-300 -mt-8" />

              {/* Student */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-sidebar/30 shadow-md bg-sidebar/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-sidebar">{firstName.charAt(0)}</span>
                </div>
                <p className="text-sm font-medium text-gray-700">{firstName}</p>
                <p className="text-[11px] text-gray-500">Terapeuta</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              {"Motivo de consulta: estr\u00e9s laboral y dificultad para poner l\u00edmites"}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setTransitioning(true);
                  setTimeout(() => { setPhase("welcome"); setTransitioning(false); }, 400);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                {"Volver"}
              </button>
              <button
                onClick={() => {
                  setSelectedComps(competencies.map((c) => c.key));
                  setTransitioning(true);
                  setTimeout(() => startPractice(), 300);
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-sidebar to-[#354080] text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 active:from-green-500 active:to-green-600 transition-all duration-300"
              >
                <Sparkles size={24} />
              </button>
              <button
                onClick={() => {
                  setSelectedComps(competencies.map((c) => c.key));
                  fetch("/api/learning/progress", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ example_id: "tutor-session", competency: "tutor" }),
                  }).then(() => window.location.href = "/dashboard");
                }}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                Omitir
              </button>
            </div>
            <p className="text-xs text-gray-400">{"Iniciar sesi\u00f3n"}</p>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════
  // FEEDBACK PHASE
  // ═════════════════════════════════════════════
  if (phase === "feedback" && feedback) {
    return (
      <div className="min-h-screen chat-pattern">
        <div className="px-4 sm:px-8 pb-8 pt-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sidebar to-[#354080] flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{"Mi retroalimentaci\u00f3n"}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {compLabels.join(" \u00b7 ")}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {feedback}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPhase("select"); setMessages([]); setFeedback(null); msgCountRef.current = 0; }}
              className="flex-1 bg-sidebar text-white py-3 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors"
            >
              Practicar de nuevo
            </button>
            <Link
              href="/dashboard"
              className="flex-1 text-center border border-gray-200 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════
  // PRACTICE PHASE (chat + inline tutor hints)
  // ═════════════════════════════════════════════
  const lastHint = [...messages].reverse().find((m) => m.role === "assistant" && m.hint)?.hint;

  return (
    <div className="flex flex-col h-screen">
      {/* Header — no back arrow */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/patients/martin-lagos.png`} alt={"Mart\u00edn"} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 text-sm">{"Mart\u00edn Lagos, 32 a\u00f1os"}</h2>
          <p className="text-[11px] text-gray-500">{compLabels.join(" \u00b7 ")}</p>
        </div>

        <button
          onClick={requestFeedback}
          disabled={messages.length < 4 || isStreaming}
          className="text-xs text-gray-500 hover:text-sidebar px-3 py-1.5 rounded-lg border border-gray-200 hover:border-sidebar/30 font-medium transition-colors disabled:opacity-40"
        >
          {"Finalizar sesi\u00f3n"}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 chat-pattern">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2.5`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/patients/martin-lagos.png`} alt={"Mart\u00edn"} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-sidebar text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>

                {/* Inline tutor hint after patient message */}
                {msg.role === "assistant" && msg.hint && (
                  <div className="flex justify-start pl-[44px] mt-2 mb-1">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5 max-w-[75%] flex items-start gap-2">
                      <GraduationCap size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        <span className="font-semibold">GlorIA:</span> {msg.hint}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 text-sm">
                  {"\uD83E\uDDD1"}
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <span className="inline-flex gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-200 px-6 py-3">
            {isRecording && (
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-500 font-medium">{"Grabando... (suelta Shift)"}</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={"Escribe tu mensaje o mant\u00e9n Shift para dictar por voz"}
                rows={1}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar"
                disabled={isStreaming}
              />
              <button
                onClick={() => isRecording ? stopRecording() : startRecording()}
                disabled={isStreaming}
                className={`p-3 rounded-xl transition-colors flex-shrink-0 ${
                  isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "border border-gray-300 text-gray-500 hover:text-sidebar hover:border-sidebar/30"
                } disabled:opacity-50`}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
                className="bg-sidebar hover:bg-[#354080] text-white p-3 rounded-xl transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Tutor sidebar panel */}
        <div className="w-[280px] bg-indigo-50/50 border-l border-indigo-100 p-4 flex flex-col gap-4 overflow-y-auto hidden lg:flex">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sidebar to-[#354080] flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">{"GlorIA \u2014 Tutora"}</p>
              <p className="text-[10px] text-gray-400">{"Gu\u00eda en tiempo real"}</p>
            </div>
          </div>

          {/* Active competencies */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">En foco</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedComps.map((k) => (
                <span key={k} className="text-[10px] bg-white border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {COMP_EMOJIS[k]} {competencies.find((c) => c.key === k)?.label}
                </span>
              ))}
            </div>
          </div>

          {/* Latest hint */}
          {lastHint && (
            <div className="bg-white rounded-xl border border-indigo-100 p-3">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1.5">Sugerencia actual</p>
              <p className="text-xs text-gray-700 leading-relaxed">{lastHint}</p>
            </div>
          )}

          {/* Turn counter */}
          <div className="mt-auto">
            <p className="text-[10px] text-gray-400">
              Turno {msgCountRef.current} de 8
            </p>
            <div className="bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-sidebar h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (msgCountRef.current / 8) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

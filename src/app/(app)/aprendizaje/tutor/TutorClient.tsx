"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, ArrowLeft, GraduationCap, CheckCircle2,
  Sparkles, BookOpen, Mic, MicOff,
} from "lucide-react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
  hint?: string;
};

type Phase = "select" | "practice" | "feedback";

const COMP_EMOJIS: Record<string, string> = {
  empathy: "💛",
  active_listening: "👂",
  open_questions: "❓",
  reformulation: "🔄",
  confrontation: "🪞",
  silence_management: "🤫",
  rapport: "🤝",
};

const COMP_DESCRIPTIONS: Record<string, string> = {
  empathy: "Comprender y comunicar la experiencia emocional del paciente",
  active_listening: "Atender con todos los sentidos: palabras, tono y silencios",
  open_questions: "Invitar a explorar y reflexionar sin dirigir",
  reformulation: "Devolver lo dicho con nuevas palabras que amplíen la perspectiva",
  confrontation: "Señalar incongruencias de forma respetuosa y oportuna",
  silence_management: "Tolerar las pausas como espacio de procesamiento",
  rapport: "Construir y mantener la alianza terapéutica",
};

export default function TutorClient({
  competencies,
}: {
  competencies: { key: string; label: string }[];
}) {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedComps, setSelectedComps] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const msgCountRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Ctrl hold to record
  useEffect(() => {
    if (phase !== "practice") return;
    const down = (e: KeyboardEvent) => { if (e.key === "Control" && !e.repeat && !isRecording && !isStreaming) startRecording(); };
    const up = (e: KeyboardEvent) => { if (e.key === "Control" && isRecording) stopRecording(); };
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
    if (selectedComps.length === 0) return;
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
        // Mark tutor as completed for unlocking modules
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
      // Mark tutor as completed
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
  // SELECTION PHASE
  // ═════════════════════════════════════════════
  if (phase === "select") {
    return (
      <div className="min-h-screen">
        <header className="px-8 py-5">
          <Link href="/aprendizaje" className="text-xs text-sidebar hover:underline mb-3 inline-block">
            &larr; Volver a Aprendizaje
          </Link>
        </header>

        <div className="px-8 pb-12 max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sidebar to-[#354080] flex items-center justify-center mx-auto mb-5 shadow-lg">
              <GraduationCap size={36} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Práctica con tutor</h1>
            <p className="text-gray-500 max-w-md mx-auto">
              Conversa con un paciente ficticio mientras un tutor clínico te guía en tiempo real con sugerencias personalizadas.
            </p>
          </div>

          {/* Patient card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 text-2xl">
              🧑
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Martín Lagos, 32 años</p>
              <p className="text-xs text-gray-500">Diseñador gráfico freelance</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Motivo de consulta: estrés laboral y dificultad para poner límites
              </p>
            </div>
          </div>

          {/* Competency grid */}
          <p className="text-sm font-semibold text-gray-700 mb-3">
            ¿Qué competencias quieres fortalecer?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {competencies.map((c) => {
              const isSelected = selectedComps.includes(c.key);
              const emoji = COMP_EMOJIS[c.key] || "📌";
              const desc = COMP_DESCRIPTIONS[c.key] || "";

              return (
                <button
                  key={c.key}
                  onClick={() => toggleComp(c.key)}
                  className={`text-left px-4 py-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-sidebar bg-sidebar/5 shadow-sm"
                      : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{c.label}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-sidebar flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setSelectedComps(competencies.map((c) => c.key))} className="text-xs text-sidebar font-medium hover:underline">
              Seleccionar todas
            </button>
            {selectedComps.length > 0 && (
              <button onClick={() => setSelectedComps([])} className="text-xs text-gray-400 hover:underline">
                Limpiar selección
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {selectedComps.length} de {competencies.length}
            </span>
          </div>

          <button
            onClick={startPractice}
            disabled={selectedComps.length === 0}
            className="w-full bg-gradient-to-r from-sidebar to-[#354080] text-white py-3.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 shadow-md"
          >
            <Sparkles size={18} />
            Iniciar sesión de práctica
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════
  // FEEDBACK PHASE
  // ═════════════════════════════════════════════
  if (phase === "feedback" && feedback) {
    return (
      <div className="min-h-screen">
        <header className="px-8 py-5">
          <Link href="/aprendizaje" className="text-xs text-sidebar hover:underline mb-3 inline-block">
            &larr; Volver a Aprendizaje
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sidebar to-[#354080] flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Retroalimentación del tutor</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {compLabels.join(" · ")}
              </p>
            </div>
          </div>
        </header>

        <div className="px-8 pb-8 max-w-3xl space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
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
              href="/aprendizaje"
              className="flex-1 text-center border border-gray-200 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Volver a Aprendizaje
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link href="/aprendizaje" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-lg">
          🧑
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 text-sm">Martín Lagos, 32 años</h2>
          <p className="text-[11px] text-gray-500">{compLabels.join(" · ")}</p>
        </div>

        <button
          onClick={requestFeedback}
          disabled={messages.length < 4 || isStreaming}
          className="text-xs text-gray-500 hover:text-sidebar px-3 py-1.5 rounded-lg border border-gray-200 hover:border-sidebar/30 font-medium transition-colors disabled:opacity-40"
        >
          Finalizar sesión
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2.5`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 mt-1 text-sm">
                      🧑
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
                        <span className="font-semibold">Tutor:</span> {msg.hint}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 text-sm">
                  🧑
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Pensando</span>
                    <span className="inline-flex gap-1">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  </div>
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
                <span className="text-xs text-red-500 font-medium">Grabando... (suelta Ctrl)</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe en texto acá o deja apretado la tecla Ctrl para transcribir tu voz"
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
              <p className="text-xs font-bold text-gray-800">Tutor clínico</p>
              <p className="text-[10px] text-gray-400">Guía en tiempo real</p>
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

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Send, X, VolumeX, Loader2, Mic, MicOff } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const HIDDEN_PATHS = ["/chat/", "/observacion/live/"];
const GLORIA_AVATAR = "https://ndwmnxlwbfqfwwtekjun.supabase.co/storage/v1/object/public/patients/gloria-avatar.jpg";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Inicio",
  "/pacientes": "Pacientes",
  "/historial": "Mi historial",
  "/progreso": "Mi progreso",
  "/aprendizaje": "Aprendizaje",
  "/mi-perfil": "Mi perfil",
  "/review": "Revisión de sesión",
  "/sobre": "Sobre GlorIA",
};

const SUGGESTIONS = [
  "¿Cómo puedo mejorar mi escucha activa?",
  "¿Con qué paciente debería practicar?",
  "Explícame mis competencias",
  "Tengo un problema técnico",
];

const GREETING = "Hola, soy GlorIA. Estoy aquí para acompañarte mientras aprendes. Pregúntame lo que necesites.";

// Render message content with markdown links as clickable
function MessageContent({ content, onNavigate }: { content: string; onNavigate: (href: string) => void }) {
  const parts = content.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (match) {
          return (
            <button
              key={i}
              onClick={() => onNavigate(match[2])}
              className="text-sidebar underline hover:text-[#354080] font-medium cursor-pointer"
            >
              {match[1]}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function GloriaAssistant({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const hidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));

  const currentPageLabel = Object.entries(PAGE_LABELS).find(
    ([path]) => pathname === path || pathname.startsWith(path + "/")
  )?.[1] || pathname;

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setHasUnread(false);
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignore clicks on the panel or the floating button
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-gloria-trigger]")) return;
      setOpen(false);
    };
    // Delay listener to avoid the opening click itself
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClick); };
  }, [open]);

  const handleNavigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: "user", content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // Add empty assistant message that will be filled by streaming
    const assistantIdx = updated.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/gloria-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, currentPage: currentPageLabel }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[assistantIdx] = { role: "assistant", content: "Disculpa, tuve un problema. Intenta de nuevo." };
          return copy;
        });
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const cleaned = accumulated.replace("[SUPPORT_TICKET]", "").trimEnd();
        setMessages((prev) => {
          const copy = [...prev];
          copy[assistantIdx] = { role: "assistant", content: cleaned };
          return copy;
        });
      }

      // Final cleanup
      const finalText = accumulated.replace("[SUPPORT_TICKET]", "").trim();
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIdx] = { role: "assistant", content: finalText };
        return copy;
      });
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIdx] = { role: "assistant", content: "Sin conexión. Intenta en un momento." };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentPageLabel]);

  // Voice input via Web Speech API
  const toggleVoice = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CL";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInput((prev) => (prev ? prev + " " : "") + transcript);
      setRecording(false);
    };

    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [recording]);

  if (hidden || muted) {
    if (muted && !hidden) {
      return (
        <button
          onClick={() => setMuted(false)}
          data-gloria-trigger
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center shadow-md transition-all cursor-pointer opacity-50 hover:opacity-100"
          title="Reactivar GlorIA"
        >
          <VolumeX size={16} className="text-gray-500" />
        </button>
      );
    }
    return null;
  }

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in"
          style={{ maxHeight: "min(560px, calc(100vh - 140px))" }}
        >
          {/* Header */}
          <div className="bg-[#2D3561] px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GLORIA_AVATAR} alt="GlorIA" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">GlorIA</p>
              <p className="text-[10px] text-white/50">Tu tutora virtual</p>
            </div>
            <button
              onClick={() => setMuted(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Silenciar GlorIA"
            >
              <VolumeX size={14} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg, i) => {
              if (msg.role === "assistant" && !msg.content) return null;
              return (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={GLORIA_AVATAR} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-sidebar text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}>
                  {msg.role === "assistant"
                    ? <MessageContent content={msg.content} onNavigate={handleNavigate} />
                    : msg.content
                  }
                </div>
              </div>
              );
            })}

            {/* Loading dots — only shown before first chunk arrives */}
            {loading && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start -mt-3">
                <div className="w-6 h-6 flex-shrink-0 mr-2" />
                <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Quick suggestions */}
            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-2.5 py-1.5 text-[11px] bg-sidebar/5 text-sidebar border border-sidebar/15 rounded-full hover:bg-sidebar/10 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleVoice}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  recording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-gray-100 text-gray-400 hover:text-sidebar hover:bg-sidebar/10"
                }`}
                title={recording ? "Detener" : "Hablar"}
              >
                {recording ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Pregunta algo, ${userName.split(" ")[0]}...`}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:bg-white"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-sidebar text-white flex items-center justify-center hover:bg-[#354080] disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        data-gloria-trigger
        className={`fixed bottom-6 right-6 z-50 rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105 ${
          open ? "w-14 h-14 bg-sidebar" : "w-16 h-16 bg-white border-2 border-sidebar/20 hover:border-sidebar/40"
        }`}
        title={open ? "Cerrar" : "Habla con GlorIA"}
      >
        {open ? (
          <X size={22} className="text-white mx-auto" />
        ) : (
          <div className="relative w-full h-full rounded-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GLORIA_AVATAR} alt="GlorIA" className="w-full h-full object-cover" />
            {hasUnread && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </div>
        )}
      </button>
    </>
  );
}

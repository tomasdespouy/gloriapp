"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import Portal from "@/components/Portal";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cómo puedo mejorar mi escucha activa?",
  "¿Dónde veo mi progreso?",
  "¿Qué es la contención de afectos?",
  "¿Cómo manejo un silencio en sesión?",
];

// Render markdown links as clickable
function renderContent(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      return (
        <Link key={i} href={match[2]} className="text-[#4A55A2] font-medium underline hover:text-[#354080]">
          {match[1]}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AskGloriaBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;

    const userMsg: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/ask-gloria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                accumulated += data.value;
                setMessages(prev => {
                  const u = [...prev];
                  u[u.length - 1] = { role: "assistant", content: accumulated };
                  return u;
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: "assistant", content: "Lo siento, hubo un error. Intenta de nuevo." };
        return u;
      });
    }
    setStreaming(false);
  };

  return (
    <Portal>
      {/* Bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 bg-gradient-to-r from-[#4A55A2] to-[#354080] text-white pl-4 pr-5 py-3 rounded-full shadow-lg shadow-[#4A55A2]/25 hover:shadow-xl hover:scale-105 transition-all"
        >
          <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-7 h-7 rounded-full object-cover" />
          <span className="text-sm font-medium">Pregúntale a GlorIA</span>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[9999] w-[380px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-pop">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#4A55A2] to-[#354080] text-white flex-shrink-0">
            <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-7 h-7 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-sm font-semibold">GlorIA</p>
              <p className="text-[10px] text-white/60">Tutora pedagógica</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { if (!streaming) setMessages([]); }}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Limpiar"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center py-4">
                <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-11 h-11 rounded-full object-cover mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-800 mb-1">Hola, soy GlorIA</p>
                <p className="text-[11px] text-gray-400 mb-4">¿En qué puedo ayudarte?</p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left px-3 py-2 rounded-lg border border-gray-200 text-[11px] text-gray-600 hover:border-[#4A55A2]/40 hover:bg-[#4A55A2]/5 hover:text-[#4A55A2] transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "gap-2"}`}>
                    {msg.role === "assistant" && (
                      <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "bg-[#4A55A2] text-white rounded-br-md"
                        : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" && !msg.content && streaming && i === messages.length - 1 ? (
                        <div className="flex items-center gap-2 py-0.5">
                          <Loader2 size={12} className="animate-spin text-[#4A55A2]" />
                          <span className="text-[10px] text-gray-400">Pensando...</span>
                        </div>
                      ) : (
                        <div className="text-[12px] leading-relaxed whitespace-pre-wrap">
                          {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Escribe tu pregunta..."
              rows={1}
              disabled={streaming}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-[#4A55A2]/30 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              className="w-8 h-8 rounded-lg bg-[#4A55A2] text-white flex items-center justify-center hover:bg-[#354080] transition-colors disabled:opacity-30"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </Portal>
  );
}

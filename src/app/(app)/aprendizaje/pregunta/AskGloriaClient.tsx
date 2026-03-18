"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Sparkles, Trash2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "¿Qué es la escucha activa y cómo puedo mejorarla?",
  "¿Cómo manejo un silencio prolongado en sesión?",
  "¿Cuál es la diferencia entre empatía y simpatía en terapia?",
  "¿Cómo establezco un buen setting terapéutico?",
  "¿Qué hago si un paciente se pone agresivo?",
  "¿Cómo puedo mejorar mi contención de afectos?",
];

export default function AskGloriaClient({ studentName }: { studentName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;

    const userMsg: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add placeholder for assistant
    setMessages([...newMessages, { role: "assistant", content: "" }]);

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
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                accumulated += data.value;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: accumulated };
                  return updated;
                });
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Lo siento, hubo un error. Intenta de nuevo." };
        return updated;
      });
    }

    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (!streaming) setMessages([]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-8 py-4 border-b border-gray-100 flex items-center gap-4">
        <Link href="/aprendizaje" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-9 h-9 rounded-full object-cover" />
          <div>
            <h1 className="text-base font-bold text-gray-900">Pregúntale a GlorIA</h1>
            <p className="text-[11px] text-gray-500">Tutora pedagógica de competencias clínicas</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            disabled={streaming}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-red-500"
            title="Limpiar conversación"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            /* Welcome + suggestions */
            <div className="text-center py-12">
              <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-16 h-16 rounded-full object-cover mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Hola {studentName.split(" ")[0]}, soy GlorIA
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-8">
                Soy tu tutora de competencias clínicas. Puedo ayudarte a entender conceptos, mejorar tus habilidades terapéuticas y prepararte para tus sesiones de práctica.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-sidebar/30 hover:bg-sidebar/5 hover:text-sidebar transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] ${msg.role === "user" ? "" : "flex gap-3"}`}>
                    {msg.role === "assistant" && (
                      <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/gloria-avatar.jpg`} alt="GlorIA" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                    )}
                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-sidebar text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" && !msg.content && streaming && i === messages.length - 1 ? (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 size={14} className="animate-spin text-sidebar" />
                          <span className="text-xs text-gray-400">GlorIA está pensando...</span>
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            disabled={streaming}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={streaming || !input.trim()}
            className="px-4 py-3 bg-sidebar text-white rounded-xl hover:bg-[#354080] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="max-w-3xl mx-auto text-[10px] text-gray-500 mt-2 text-center">
          GlorIA es una tutora pedagógica. No reemplaza la supervisión clínica humana.
        </p>
      </div>
    </div>
  );
}

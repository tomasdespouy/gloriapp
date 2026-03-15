"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ArrowLeft, LogOut, Mic, MicOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Patient {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  presenting_problem: string;
  difficulty_level: string;
}

interface Message {
  role: string;
  content: string;
  created_at?: string;
}

interface ChatInterfaceProps {
  patient: Patient;
  conversationId?: string;
  initialMessages: Message[];
}

type Phase = "idle" | "thinking" | "writing";

const CHAR_DELAY_MS = 35;

export function ChatInterface({ patient, conversationId: initialConvId, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConvId);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const router = useRouter();

  // Active time tracking (only counts when tab is visible)
  const activeSecondsRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceFiredRef = useRef(false);
  const SILENCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // Token buffer for slow typing effect
  const tokenBufferRef = useRef<string>("");
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamDoneRef = useRef(false);
  const lastAssistantMsgRef = useRef<string>("");

  // ═══ REALTIME (WebSocket) — Patient interruptions & typing detection ═══
  const realtimeUnsubRef = useRef<(() => void) | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptFiredRef = useRef(false);
  const lastUserMsgIdRef = useRef(0); // tracks which user message started the idle cycle

  // Subscribe to Realtime channel when conversationId is available
  useEffect(() => {
    if (!conversationId) return;

    let unsubscribe: (() => void) | null = null;

    import("@/lib/supabase/realtime-chat").then(({ subscribeToConversation }) => {
      unsubscribe = subscribeToConversation(conversationId, (event) => {
        if (event.type === "interrupt" || event.type === "reaction") {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: event.content,
            created_at: new Date().toISOString(),
          }]);
        }
      });
      realtimeUnsubRef.current = unsubscribe;
    });

    return () => {
      if (realtimeUnsubRef.current) realtimeUnsubRef.current();
      realtimeUnsubRef.current = null;
    };
  }, [conversationId]);

  // Typing detection — resets idle timer when user is actively typing
  const handleTypingActivity = useCallback(() => {
    if (isStreaming || !conversationId) return;

    // Reset "typing too long" timer (fires after 60s of typing without sending)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (isStreaming || interruptFiredRef.current) return;
      interruptFiredRef.current = true;
      fetch("/api/chat/interrupt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, conversationId, trigger: "typing_long" }),
      }).then(r => r.json()).then(data => {
        if (data.message) {
          setMessages(prev => [...prev, {
            role: "assistant", content: data.message, created_at: new Date().toISOString(),
          }]);
        }
      }).catch(() => {});
    }, 60000);

    // Also reset idle timer since user is active
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, [isStreaming, conversationId, patient.id]);

  // Single idle timer: fires 90s after the LAST USER message's response arrives
  // Only triggers ONCE per user message cycle (won't re-trigger from its own output)
  useEffect(() => {
    const userMsgCount = messages.filter(m => m.role === "user").length;
    const lastMsg = messages[messages.length - 1];

    // Only start idle timer when a NEW assistant response arrives after a user message
    if (!lastMsg || lastMsg.role !== "assistant" || !conversationId || isStreaming) return;
    if (userMsgCount === lastUserMsgIdRef.current) return; // same cycle, don't re-trigger
    lastUserMsgIdRef.current = userMsgCount;
    interruptFiredRef.current = false;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      if (isStreaming || interruptFiredRef.current) return;
      interruptFiredRef.current = true;
      fetch("/api/chat/interrupt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, conversationId, trigger: "idle_short" }),
      }).then(r => r.json()).then(data => {
        if (data.message) {
          setMessages(prev => [...prev, {
            role: "assistant", content: data.message, created_at: new Date().toISOString(),
          }]);
        }
      }).catch(() => {});
    }, 90000);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversationId, isStreaming, patient.id]);

  // Patient avatar (PNG)
  const avatarSlug = patient.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  const avatarSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${avatarSlug}.png`;
  const initials = patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Active time tracker — only counts when tab is visible
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) {
        const now = Date.now();
        const delta = Math.round((now - lastTickRef.current) / 1000);
        if (delta > 0 && delta < 10) { // ignore large jumps (tab was hidden)
          activeSecondsRef.current += delta;
        }
        lastTickRef.current = now;
      } else {
        lastTickRef.current = Date.now(); // reset on visibility change
      }
    };

    const interval = setInterval(tick, 1000);

    // Persist active time every 30 seconds
    const persistInterval = setInterval(() => {
      if (conversationId && activeSecondsRef.current > 0) {
        fetch(`/api/sessions/${conversationId}/active-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_seconds: activeSecondsRef.current }),
        }).catch(() => {});
      }
    }, 30000);

    const handleVisibility = () => { lastTickRef.current = Date.now(); };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(persistInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      // Final persist on unmount
      if (conversationId && activeSecondsRef.current > 0) {
        navigator.sendBeacon?.(
          `/api/sessions/${conversationId}/active-time`,
          new Blob([JSON.stringify({ active_seconds: activeSecondsRef.current })], { type: "application/json" })
        );
      }
    };
  }, [conversationId]);

  // Silence timer — patient reacts after 5 min without USER sending a message
  const lastUserMsgCount = useRef(0);

  useEffect(() => {
    // Count user messages only
    const userMsgCount = messages.filter((m) => m.role === "user").length;

    // Only reset timer when the USER sends a new message (not when patient responds)
    if (userMsgCount > lastUserMsgCount.current) {
      lastUserMsgCount.current = userMsgCount;
      silenceFiredRef.current = false;

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      silenceTimerRef.current = setTimeout(async () => {
        if (silenceFiredRef.current || !conversationId || isStreaming) return;
        silenceFiredRef.current = true;

        try {
          const res = await fetch("/api/chat/silence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId: patient.id, conversationId }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.message) {
              setMessages((prev) => [...prev, {
                role: "assistant",
                content: data.message,
                created_at: new Date().toISOString(),
              }]);
            }
          }
        } catch { /* silence timer is optional */ }
      }, SILENCE_TIMEOUT_MS);
    }
    // Only clean up on unmount, not on every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversationId, patient.id, isStreaming]);

  // Ctrl hold to record
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" && !e.repeat && !isRecording && !isStreaming) {
        startRecording();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" && isRecording) {
        stopRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drain buffer character by character
  const drainBuffer = useCallback(() => {
    if (tokenBufferRef.current.length > 0) {
      const chunk = tokenBufferRef.current.slice(0, 2);
      tokenBufferRef.current = tokenBufferRef.current.slice(chunk.length);

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          const newContent = last.content + chunk;
          updated[updated.length - 1] = { ...last, content: newContent };
          lastAssistantMsgRef.current = newContent;
        }
        return updated;
      });

      drainTimerRef.current = setTimeout(drainBuffer, CHAR_DELAY_MS);
    } else if (streamDoneRef.current) {
      setPhase("idle");
      setIsStreaming(false);
    } else {
      drainTimerRef.current = setTimeout(drainBuffer, CHAR_DELAY_MS);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
    };
  }, []);

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = input; // Preserve existing text

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const [correcting, setCorrecting] = useState(false);

  const stopRecording = async () => {
    recognitionRef.current?.stop();
    setIsRecording(false);

    // Auto-correct transcription
    await new Promise((r) => setTimeout(r, 300)); // Wait for final transcript
    const currentText = (document.querySelector("textarea") as HTMLTextAreaElement)?.value?.trim();
    if (!currentText) return;

    setCorrecting(true);
    try {
      const res = await fetch("/api/chat/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentText }),
      });
      if (res.ok) {
        const { corrected } = await res.json();
        if (corrected && corrected !== currentText) {
          setInput(corrected);
        }
      }
    } catch { /* keep original */ }
    setCorrecting(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const now = new Date().toISOString();

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed, created_at: now }]);
    setIsStreaming(true);
    setPhase("thinking");
    streamDoneRef.current = false;
    // Reset interrupt flags on new message
    interruptFiredRef.current = false;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    tokenBufferRef.current = "";
    lastAssistantMsgRef.current = "";

    // Add empty assistant message with timestamp
    setMessages((prev) => [...prev, { role: "assistant", content: "", created_at: new Date().toISOString() }]);

    // Start draining buffer
    drainTimerRef.current = setTimeout(drainBuffer, CHAR_DELAY_MS);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          conversationId,
          message: trimmed,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Error en la respuesta");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "conversation_id") {
            setConversationId(data.value);
          } else if (data.type === "token") {
            // First token received → switch from "thinking" to "writing"
            if (phase === "thinking" || tokenBufferRef.current.length === 0) {
              setPhase("writing");
            }
            tokenBufferRef.current += data.value;
          } else if (data.type === "error") {
            tokenBufferRef.current = "";
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: "Error: " + data.value,
                created_at: new Date().toISOString(),
              };
              return updated;
            });
          }
        }
      }
    } catch {
      tokenBufferRef.current = "";
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant" && !updated[updated.length - 1]?.content) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Error de conexión. Intenta de nuevo.",
            created_at: new Date().toISOString(),
          };
        }
        return updated;
      });
      setPhase("idle");
      setIsStreaming(false);
    }

    streamDoneRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEndSession = () => {
    if (!conversationId) return;
    router.push(`/review/${conversationId}`);
  };

  const renderContent = (content: string) => {
    // Escape HTML first to prevent XSS, then apply formatting
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return escaped.replace(/\[([^\]]+)\]/g, '<em class="text-gray-400">[$1]</em>');
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatDateSeparator = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoy";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const lastMsg = messages[messages.length - 1];
  const showThinkingBubble = phase === "thinking" && lastMsg?.role === "assistant" && !lastMsg.content;
  const showWritingSubtext = phase === "writing" && lastMsg?.role === "assistant" && !!lastMsg.content;

  // Header status
  const headerStatus = phase === "thinking"
    ? "Pensando"
    : phase === "writing"
    ? "Escribiendo"
    : null;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>

        <PatientAvatar src={avatarSrc} initials={initials} size={40} />

        <div className="flex-1">
          <h2 className="font-bold text-gray-900">{patient.name}</h2>
          <p className="text-xs text-gray-500">
            {patient.age} años, {patient.occupation}
            {headerStatus && (
              <span className="ml-2 text-sidebar">
                &middot; {headerStatus}
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </span>
            )}
          </p>
        </div>

        {/* End session button */}
        {conversationId && messages.length >= 2 && !isStreaming && (
          <button
            onClick={() => setShowEndConfirm(true)}
            className="end-session-btn flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-semibold"
          >
            <LogOut size={14} />
            Finalizar sesión
          </button>
        )}
      </header>

      {/* End session confirmation modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowEndConfirm(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <LogOut size={20} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">¿Finalizar sesión?</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              La sesión se guardará y no podrás continuar esta conversación. Para seguir practicando deberás iniciar una nueva sesión con el paciente.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleEndSession}
                className="end-session-btn flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Sí, finalizar
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Continuar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg font-medium mb-2">Sesión con {patient.name}</p>
            <p className="text-sm">{patient.presenting_problem}</p>
            <p className="text-sm mt-4">Escribe tu primera intervención como terapeuta.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          // Skip rendering empty assistant message when typing bubble is shown
          if (i === messages.length - 1 && msg.role === "assistant" && !msg.content && phase !== "idle") {
            return null;
          }

          // Date separator
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showDateSep =
            msg.created_at &&
            (!prevMsg?.created_at ||
              new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString());

          return (
            <div key={i}>
              {showDateSep && (
                <div className="flex justify-center my-4">
                  <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2.5 ${msg.role === "user" ? "animate-msg-right" : "animate-msg-left"}`}>
                {/* Patient avatar (assistant messages only) */}
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <PatientAvatar src={avatarSrc} initials={initials} size={32} />
                  </div>
                )}

                <div className="flex flex-col max-w-[70%]">
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
                      msg.role === "user"
                        ? "bg-sidebar text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                    }`}
                    dangerouslySetInnerHTML={
                      msg.role === "assistant"
                        ? { __html: renderContent(msg.content) || '<span class="animate-pulse text-gray-300">...</span>' }
                        : undefined
                    }
                  >
                    {msg.role === "user" ? msg.content : undefined}
                  </div>

                  {/* Timestamp */}
                  {msg.created_at && (
                    <span
                      className={`text-[10px] text-gray-400 mt-1 ${
                        msg.role === "user" ? "text-right" : "text-left"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking bubble — shown before first token */}
        {showThinkingBubble && (
          <div className="flex justify-start gap-2.5 animate-msg-left">
            <div className="flex-shrink-0 mt-1">
              <PatientAvatar src={avatarSrc} initials={initials} size={32} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 animate-pulse">Pensando</span>
                <span className="inline-flex gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Writing subtext — below message while buffer is draining */}
        {showWritingSubtext && (
          <div className="flex justify-start pl-[44px]">
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              Escribiendo
              <span className="inline-flex gap-0.5">
                <span className="typing-dot" style={{ width: 4, height: 4 }} />
                <span className="typing-dot" style={{ width: 4, height: 4 }} />
                <span className="typing-dot" style={{ width: 4, height: 4 }} />
              </span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        {isRecording && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-medium">Grabando audio... (suelta Ctrl para detener)</span>
          </div>
        )}
        {correcting && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-sidebar animate-pulse" />
            <span className="text-xs text-sidebar font-medium">Corrigiendo ortografía...</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTypingActivity(); }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe en texto acá o deja apretado la tecla Ctrl para transcribir tu voz"
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar"
            disabled={false}
          />

          {/* Mic button (right side) */}
          <button
            onClick={toggleRecording}
            disabled={isStreaming}
            className={`p-3 rounded-xl transition-colors flex-shrink-0 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "border border-gray-300 text-gray-500 hover:text-sidebar hover:border-sidebar/30"
            } disabled:opacity-50`}
            title={isRecording ? "Detener grabacion (soltar Ctrl)" : "Grabar audio (mantener Ctrl)"}
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
  );
}

// ——— Patient Avatar (PNG) ———

function PatientAvatar({ src, initials, size }: { src: string; initials: string; size: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="rounded-full overflow-hidden bg-sidebar flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={initials}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
          {initials}
        </span>
      )}
    </div>
  );
}

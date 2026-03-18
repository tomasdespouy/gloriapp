"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ArrowLeft, LogOut, Mic, MicOff, Volume2, Square, Loader2, Clock, X, Phone, PhoneOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Patient {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  presenting_problem: string;
  difficulty_level: string;
  voice_id?: string | null;
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
  initialActiveSeconds?: number;
}

type Phase = "idle" | "thinking" | "writing";

const CHAR_DELAY_MS = 35;

export function ChatInterface({ patient, conversationId: initialConvId, initialMessages, initialActiveSeconds = 0 }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConvId);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(initialActiveSeconds);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false); // true = audio playing, hide text
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showVoiceConsent, setShowVoiceConsent] = useState(false);
  const voiceModeRef = useRef(false);
  const messagesRef = useRef<Message[]>(initialMessages);
  const isStreamingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const router = useRouter();

  // TTS (ElevenLabs)
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingTtsIdx, setLoadingTtsIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Streaming TTS queue for voice mode
  const ttsQueueRef = useRef<string[]>([]);
  const ttsPlayingRef = useRef(false);
  const ttsSentenceBufferRef = useRef("");
  const ttsStreamDoneRef = useRef(false);

  const fetchTtsBlob = async (text: string): Promise<Blob | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: patient.voice_id }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch { return null; }
  };

  // Play queued TTS chunks sequentially
  const drainTtsQueue = async () => {
    if (ttsPlayingRef.current) return;
    ttsPlayingRef.current = true;

    while (ttsQueueRef.current.length > 0) {
      const sentence = ttsQueueRef.current.shift()!;
      const blob = await fetchTtsBlob(sentence);
      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    }

    audioRef.current = null;
    ttsPlayingRef.current = false;

    // If stream is done and queue is empty, finish voice mode playback
    if (ttsStreamDoneRef.current) {
      setPlayingIdx(null);
      setVoiceSpeaking(false);
      ttsStreamDoneRef.current = false;

      // Type text gradually after audio finishes
      const fullText = lastAssistantMsgRef.current;
      if (fullText) {
        let charIdx = 0;
        const typeInterval = setInterval(() => {
          charIdx += 2;
          const partial = fullText.substring(0, charIdx);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: partial };
            }
            return updated;
          });
          if (charIdx >= fullText.length) {
            clearInterval(typeInterval);
            if (voiceModeRef.current && voiceRecognitionRef.current) {
              setTimeout(() => {
                try { voiceRecognitionRef.current?.start(); setIsRecording(true); } catch {}
              }, 500);
            }
          }
        }, CHAR_DELAY_MS);
      }
    }
  };

  // Push a sentence to TTS queue and start draining
  const queueTtsSentence = (sentence: string) => {
    const clean = sentence.trim();
    if (!clean) return;
    ttsQueueRef.current.push(clean);
    if (!ttsPlayingRef.current) drainTtsQueue();
  };

  // Check sentence buffer for complete sentences and queue them
  const flushSentenceBuffer = (force: boolean = false) => {
    const buf = ttsSentenceBufferRef.current;
    // Match sentences ending with . ? ! ... or stage directions [...]
    const sentenceEnd = /([.!?]+|\.\.\.)(\s|$)/g;
    let lastIdx = 0;
    let match;
    while ((match = sentenceEnd.exec(buf)) !== null) {
      const endPos = match.index + match[0].length;
      const sentence = buf.slice(lastIdx, endPos).trim();
      if (sentence) queueTtsSentence(sentence);
      lastIdx = endPos;
    }
    ttsSentenceBufferRef.current = buf.slice(lastIdx);

    // If force flush (stream done), send remaining text
    if (force && ttsSentenceBufferRef.current.trim()) {
      queueTtsSentence(ttsSentenceBufferRef.current);
      ttsSentenceBufferRef.current = "";
    }
  };

  const playTts = async (text: string, idx: number) => {
    // If already playing this message, stop it
    if (playingIdx === idx) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingIdx(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingIdx(null);
    }

    setLoadingTtsIdx(idx);
    try {
      const blob = await fetchTtsBlob(text);
      if (!blob) throw new Error("TTS failed");

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setPlayingIdx(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audioRef.current = audio;
      setPlayingIdx(idx);
      setLoadingTtsIdx(null);
      await audio.play();
    } catch {
      setLoadingTtsIdx(null);
      setPlayingIdx(null);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      ttsQueueRef.current = [];
      ttsPlayingRef.current = false;
    };
  }, []);

  // Sync refs
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // Auto-play TTS function (for voice mode) — kept for non-streaming uses
  const autoPlayTts = async (text: string, idx: number) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const blob = await fetchTtsBlob(text);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPlayingIdx(null); audioRef.current = null; URL.revokeObjectURL(url); };
      audioRef.current = audio;
      setPlayingIdx(idx);
      await audio.play();
    } catch { /* TTS failed silently */ }
  };

  // Auto-play TTS with callback when audio finishes
  const autoPlayTtsWithCallback = async (text: string, idx: number, onDone: () => void) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const blob = await fetchTtsBlob(text);
      if (!blob) { onDone(); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingIdx(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
        onDone();
      };
      audio.onerror = () => { onDone(); };
      audioRef.current = audio;
      setPlayingIdx(idx);
      await audio.play();
    } catch {
      onDone();
    }
  };

  // Session time tracking — real elapsed time, resuming from DB value
  const sessionStartRef = useRef(Date.now());
  const activeSecondsRef = useRef(initialActiveSeconds);

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
          // Prevent duplicates: check if this content already exists in recent messages
          setMessages((prev) => {
            const lastFew = prev.slice(-3);
            const isDuplicate = lastFew.some(m => m.role === "assistant" && m.content === event.content);
            if (isDuplicate) return prev;
            return [...prev, {
              role: "assistant",
              content: event.content,
              created_at: new Date().toISOString(),
            }];
          });
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
      if (isStreaming || interruptFiredRef.current || voiceModeRef.current) return;
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
      // Don't interrupt in voice mode (mic is active, user is engaged)
      if (isStreaming || interruptFiredRef.current || voiceModeRef.current) return;
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

  // Patient media
  const avatarSlug = patient.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  const videoSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${avatarSlug}.mp4`;
  const imageSrc = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${avatarSlug}.png`;
  const initials = patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
  }, [messages]);

  // Session timer — real elapsed time (counts even when tab is hidden)
  useEffect(() => {
    const start = sessionStartRef.current;

    const tick = () => {
      const elapsed = initialActiveSeconds + Math.round((Date.now() - start) / 1000);
      activeSecondsRef.current = elapsed;
      setDisplaySeconds(elapsed);
    };

    const interval = setInterval(tick, 1000);

    // Persist every 15 seconds
    const persistInterval = setInterval(() => {
      if (conversationId && activeSecondsRef.current > 0) {
        fetch(`/api/sessions/${conversationId}/active-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_seconds: activeSecondsRef.current }),
        }).catch(() => {});
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(persistInterval);
      // Final persist on unmount
      if (conversationId && activeSecondsRef.current > 0) {
        navigator.sendBeacon?.(
          `/api/sessions/${conversationId}/active-time`,
          new Blob([JSON.stringify({ active_seconds: activeSecondsRef.current })], { type: "application/json" })
        );
      }
    };
  }, [conversationId]);

  // Multi-stage silence timers
  // Text mode: 90s → 3min → 5min | Voice mode: 30s → 90s → 2min
  const SILENCE_TIMERS_TEXT = [90_000, 180_000, 300_000];
  const SILENCE_TIMERS_VOICE = [30_000, 90_000, 120_000];
  const lastUserMsgCount = useRef(0);
  const silenceStageRef = useRef(0);
  const silenceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearSilenceTimers = () => {
    silenceTimersRef.current.forEach((t) => clearTimeout(t));
    silenceTimersRef.current = [];
  };

  const fireSilenceStage = async (stage: number) => {
    if (!conversationId || isStreamingRef.current) return;

    try {
      const res = await fetch("/api/chat/silence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, conversationId, stage }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: data.message,
            created_at: new Date().toISOString(),
          }]);

          // In voice mode, play TTS for silence messages
          if (voiceModeRef.current && patient.voice_id) {
            const msgIdx = messagesRef.current.length;
            autoPlayTts(data.message, msgIdx);
          }

          // Stage 3: session closed by patient — show disconnect modal
          if (data.sessionClosed) {
            if (voiceModeRef.current) stopVoiceMode();
            clearSilenceTimers();
            setShowDisconnect(true);
          }
        }
      }
    } catch { /* silence timer is optional */ }
  };

  const startSilenceTimers = () => {
    clearSilenceTimers();
    silenceStageRef.current = 0;
    const timers = voiceModeRef.current ? SILENCE_TIMERS_VOICE : SILENCE_TIMERS_TEXT;

    timers.forEach((delay, i) => {
      const t = setTimeout(() => fireSilenceStage(i + 1), delay);
      silenceTimersRef.current.push(t);
    });
  };

  useEffect(() => {
    const userMsgCount = messages.filter((m) => m.role === "user").length;

    if (userMsgCount > lastUserMsgCount.current) {
      lastUserMsgCount.current = userMsgCount;
      startSilenceTimers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversationId, patient.id]);

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

      // In voice mode: accumulate text silently, don't show it
      if (voiceModeRef.current && patient.voice_id) {
        lastAssistantMsgRef.current += chunk;
      } else {
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
      }

      drainTimerRef.current = setTimeout(drainBuffer, CHAR_DELAY_MS);
    } else if (streamDoneRef.current) {
      setPhase("idle");
      setIsStreaming(false);
      // Voice mode: streaming TTS already started during GPT streaming
      if (voiceModeRef.current && lastAssistantMsgRef.current && patient.voice_id) {
        const msgIdx = messagesRef.current.length - 1;

        // Show "Hablando..." indicator (text stays empty until audio finishes)
        setVoiceSpeaking(true);
        setPlayingIdx(msgIdx);

        // Flush remaining sentence buffer and signal stream done
        flushSentenceBuffer(true);
        ttsStreamDoneRef.current = true;

        // If TTS queue is already empty (all sentences already played), trigger finish
        if (!ttsPlayingRef.current && ttsQueueRef.current.length === 0) {
          drainTtsQueue();
        }
      }
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
    recognition.onerror = (e: Event & { error?: string }) => {
      setIsRecording(false);
      if (e.error === "not-allowed") {
        alert("Permiso de micrófono denegado. Habilita el micrófono en la configuración de tu navegador.");
      } else if (e.error === "network") {
        alert("Error de red en el reconocimiento de voz. Verifica tu conexión a internet.");
      }
    };

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

  // ═══ VOICE MODE — continuous speech-to-text + auto-send + TTS response ═══
  const voiceAutoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecognitionRef = useRef<SpeechRecognition | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(null as any);

  const requestVoiceMode = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Tu navegador no soporta reconocimiento de voz."); return; }
    setShowVoiceConsent(true);
  };

  const startVoiceMode = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setShowVoiceConsent(false);
    setVoiceMode(true);

    const recognition = new SR();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = true;

    let transcript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (finalText) transcript += finalText;
      setInput(transcript + interim);

      // Auto-send after 2s of silence (reset timer on each result)
      if (voiceAutoSendTimerRef.current) clearTimeout(voiceAutoSendTimerRef.current);
      if (transcript.trim()) {
        voiceAutoSendTimerRef.current = setTimeout(() => {
          const textToSend = transcript.trim();
          if (textToSend && !isStreamingRef.current && sendMessageRef.current) {
            transcript = "";
            setInput("");
            // Stop recognition before sending
            try { recognition.stop(); } catch {}
            // Auto-correct before sending (adds ¿? and tildes)
            fetch("/api/chat/correct", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: textToSend }),
            })
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                const corrected = data?.corrected || textToSend;
                sendMessageRef.current(corrected);
              })
              .catch(() => {
                sendMessageRef.current(textToSend);
              });
          }
        }, 2000);
      }
    };

    recognition.onend = () => {
      // Restart if voice mode is still active and not streaming
      if (voiceModeRef.current && !isStreamingRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch { /* already started */ }
        }, 300);
      }
    };

    recognition.onerror = (e) => {
      console.log("Voice recognition error:", (e as Event & { error?: string }).error);
      if (voiceModeRef.current && !isStreamingRef.current) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 1000);
      }
    };

    voiceRecognitionRef.current = recognition;
    try { recognition.start(); } catch {}
    setIsRecording(true);
  };

  const stopVoiceMode = () => {
    setVoiceMode(false);
    if (voiceAutoSendTimerRef.current) clearTimeout(voiceAutoSendTimerRef.current);
    voiceRecognitionRef.current?.stop();
    voiceRecognitionRef.current = null;
    setIsRecording(false);
    setInput("");
  };

  // Restart voice recognition after TTS playback ends (voice mode)
  const autoPlayTtsAndResumeMic = async (text: string, idx: number) => {
    // Pause mic during TTS
    voiceRecognitionRef.current?.stop();
    setIsRecording(false);

    await autoPlayTts(text, idx);

    // Wait for audio to finish, then restart mic
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setPlayingIdx(null);
        audioRef.current = null;
        // Restart mic if voice mode still active
        if (voiceModeRef.current) {
          setTimeout(() => {
            if (voiceRecognitionRef.current && voiceModeRef.current) {
              try { voiceRecognitionRef.current.start(); setIsRecording(true); } catch {}
            }
          }, 500);
        }
      };
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText || input).trim();
    if (!trimmed || isStreaming) return;

    // Pause voice recognition during streaming
    if (voiceMode) {
      voiceRecognitionRef.current?.stop();
      setIsRecording(false);
    }

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

    // Reset streaming TTS state
    ttsQueueRef.current = [];
    ttsSentenceBufferRef.current = "";
    ttsStreamDoneRef.current = false;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    ttsPlayingRef.current = false;

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
              // In voice mode, show "Hablando..." immediately from first token
              if (voiceModeRef.current && patient.voice_id) {
                setVoiceSpeaking(true);
              }
            }
            tokenBufferRef.current += data.value;
            // Feed tokens to TTS sentence buffer in voice mode
            if (voiceModeRef.current && patient.voice_id) {
              ttsSentenceBufferRef.current += data.value;
              flushSentenceBuffer();
            }
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

  // Keep ref updated for voice mode closure
  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEndSession = async () => {
    if (!conversationId) return;

    // Stop voice mode and any audio playback before navigating
    if (voiceMode) stopVoiceMode();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingIdx(null);
    }

    // Persist final active time BEFORE navigating to review
    if (activeSecondsRef.current > 0) {
      try {
        await fetch(`/api/sessions/${conversationId}/active-time`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_seconds: activeSecondsRef.current }),
        });
      } catch { /* navigate anyway */ }
    }

    router.push(`/review/${conversationId}`);
  };

  const renderContent = (content: string) => {
    // Render non-verbal cues as subtle italic text
    return content.replace(/\[([^\]]*)\]/g, '<span class="text-gray-400 italic text-xs">[$1]</span>');
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

  // Format timer display
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 sm:p-2 -ml-1 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="sm:hidden" strokeWidth={2.5} />
          <ArrowLeft size={24} className="hidden sm:block" strokeWidth={2.5} />
        </Link>

        {/* Patient video avatar — clickable */}
        <button
          onClick={() => setShowVideoModal(true)}
          className="flex-shrink-0 rounded-full overflow-hidden bg-sidebar w-10 h-10 sm:w-12 sm:h-12"
        >
          <PatientVideo videoSrc={videoSrc} imageSrc={imageSrc} initials={initials} size={48} />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate text-sm sm:text-base">{patient.name}</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
            {patient.age} años, {patient.occupation}
          </p>
        </div>

        {/* Voice mode toggle + Session timer + End session button */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {patient.voice_id && (
            <button
              onClick={() => voiceMode ? stopVoiceMode() : requestVoiceMode()}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                voiceMode
                  ? "bg-green-500 text-white animate-pulse"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              title={voiceMode ? "Desactivar modo voz" : "Activar conversación por voz"}
            >
              {voiceMode ? <Phone size={13} /> : <Mic size={13} />}
              <span className="hidden sm:inline">{voiceMode ? "Voz activa" : "Modo voz"}</span>
            </button>
          )}

          <span className="flex items-center gap-1.5 text-xs text-gray-400 tabular-nums">
            <Clock size={13} />
            {formatTimer(displaySeconds)}
          </span>

          {conversationId && messages.length >= 2 && !isStreaming && (
            <button
              onClick={() => setShowEndConfirm(true)}
              className="end-session-btn flex items-center gap-2 bg-red-500 text-white px-3 md:px-4 py-2 rounded-lg text-xs font-semibold"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Finalizar sesión</span>
              <span className="sm:hidden">Salir</span>
            </button>
          )}
        </div>
      </header>

      {/* Video modal — fullscreen preview */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setShowVideoModal(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="rounded-2xl overflow-hidden w-[min(300px,85vw)] h-[min(300px,85vw)]">
              <PatientVideo videoSrc={videoSrc} imageSrc={imageSrc} initials={initials} size={300} />
            </div>
          </div>
        </div>
      )}

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

      {/* Voice mode consent modal */}
      {showVoiceConsent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowVoiceConsent(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <Mic size={20} className="text-sidebar" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Activar modo voz</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Al activar el modo voz, tu micrófono se encenderá y todo lo que digas se enviará directamente al paciente, sin posibilidad de editar el texto antes del envío.
            </p>
            <p className="text-xs text-gray-400">
              Puedes desactivar el modo voz en cualquier momento.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={startVoiceMode}
                className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-sidebar-hover transition-colors"
              >
                Aceptar y activar
              </button>
              <button
                onClick={() => setShowVoiceConsent(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient disconnected modal */}
      {showDisconnect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 space-y-5 animate-pop text-center">
            {/* Patient photo */}
            <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={patient.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{patient.name} se ha desconectado</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Debido a que no hubo respuesta por un tiempo prolongado, el paciente decidió retirarse de la sesión.
            </p>
            <p className="text-xs text-gray-400">
              Esto puede afectar el vínculo terapéutico en futuras sesiones.
            </p>
            <button
              onClick={() => router.push(`/review/${conversationId}`)}
              className="w-full bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-sidebar-hover transition-colors"
            >
              Ver resumen de sesión
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg font-medium mb-2">Sesión con {patient.name}</p>
            {patient.difficulty_level === "beginner" && (
              <p className="text-sm">{patient.presenting_problem}</p>
            )}
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
                    <PatientAvatar src={imageSrc} initials={initials} size={32} />
                  </div>
                )}

                <div className="flex flex-col max-w-[92%] sm:max-w-[85%] md:max-w-[70%]">
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

                  {/* Timestamp + TTS button */}
                  <div className={`flex items-center gap-1.5 mt-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.created_at && (
                      <span className="text-[10px] text-gray-400">
                        {formatTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking bubble — shown before first token */}
        {showThinkingBubble && (
          <div className="flex justify-start gap-2.5 animate-msg-left">
            <div className="flex-shrink-0 mt-1">
              <PatientAvatar src={imageSrc} initials={initials} size={32} />
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

        {/* Voice speaking bubble — audio playing, text hidden */}
        {voiceSpeaking && (
          <div className="flex justify-start gap-2.5 animate-msg-left">
            <div className="flex-shrink-0 mt-1">
              <PatientAvatar src={imageSrc} initials={initials} size={32} />
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-green-600 animate-pulse" />
                <span className="text-xs text-green-700 font-medium">Hablando...</span>
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
      <div className="bg-white border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
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
            placeholder="Escribe tu mensaje..."
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar"
            disabled={false}
          />

          {/* Mic button (right side) */}
          <button
            onClick={toggleRecording}
            disabled={isStreaming}
            className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-colors flex-shrink-0 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "border border-gray-300 text-gray-500 hover:text-sidebar hover:border-sidebar/30"
            } disabled:opacity-50`}
            title={isRecording ? "Detener grabacion (soltar Ctrl)" : "Grabar audio (mantener Ctrl)"}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            data-send-btn
            onClick={() => sendMessage()}
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

// ——— Patient Video (MP4) ———

function PatientVideo({ videoSrc, imageSrc, initials, size }: { videoSrc: string; imageSrc: string; initials: string; size: number }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  if (!videoFailed) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setVideoFailed(true)}
      />
    );
  }

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={initials}
        className="w-full h-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center bg-sidebar"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
        {initials}
      </span>
    </div>
  );
}

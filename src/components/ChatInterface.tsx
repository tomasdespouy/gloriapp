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
  userAvatarUrl?: string | null;
  userName?: string;
}

type Phase = "idle" | "thinking" | "writing";

const CHAR_DELAY_MS = 35;

export function ChatInterface({ patient, conversationId: initialConvId, initialMessages, initialActiveSeconds = 0, userAvatarUrl, userName = "" }: ChatInterfaceProps) {
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConvId);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(initialActiveSeconds);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(initialMessages.length > 0);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
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

  // Session time tracking — starts when sessionStarted becomes true
  const sessionStartRef = useRef(initialMessages.length > 0 ? Date.now() : 0);
  const activeSecondsRef = useRef(initialActiveSeconds);

  // Token buffer for slow typing effect
  const tokenBufferRef = useRef<string>("");
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamDoneRef = useRef(false);
  const lastAssistantMsgRef = useRef<string>("");

  // ═══ REALTIME (WebSocket) — Patient interruptions & typing detection ═══
  const realtimeUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to Realtime channel when conversationId is available
  useEffect(() => {
    if (!conversationId) return;

    let unsubscribe: (() => void) | null = null;

    import("@/lib/supabase/realtime-chat").then(({ subscribeToConversation }) => {
      unsubscribe = subscribeToConversation(conversationId, (event) => {
        if (event.type === "interrupt" || event.type === "reaction") {
          // Skip if currently streaming — the interrupt was already handled locally
          if (isStreamingRef.current) return;
          // Prevent duplicates: check if this content already exists in recent messages
          setMessages((prev) => {
            const isDuplicate = prev.some(m => m.role === "assistant" && m.content === event.content);
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

  // Typing detection — resets silence timers when user is actively typing
  const handleTypingActivity = useCallback(() => {
    if (isStreamingRef.current || !conversationId) return;
    // User is typing: reset all silence timers (they restart after next assistant response)
    clearSilenceTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

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

  // Session timer — wall-clock time, starts only when session is started
  useEffect(() => {
    if (!sessionStarted) return;

    // Set start time when session begins (if not already set from resume)
    if (sessionStartRef.current === 0) {
      sessionStartRef.current = Date.now();
    }
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
  }, [conversationId, sessionStarted]);

  // Multi-stage silence timers (from last assistant message)
  // Stage 1 (60s):  saludo extrañado
  // Stage 2 (90s):  pregunta si está ahí
  // Stage 3 (180s): aviso de retiro
  // Stage 4 (300s): cierre de sesión
  const SILENCE_TIMERS_TEXT = [60_000, 90_000, 180_000, 300_000];
  const SILENCE_TIMERS_VOICE = [30_000, 60_000, 90_000, 120_000];
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

  // Start silence timers ONLY after a normal assistant response (not silence messages)
  // Track user message count to know when a new "real" exchange happened
  useEffect(() => {
    if (!conversationId || isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || !lastMsg.content) return;

    const userMsgCount = messages.filter((m) => m.role === "user").length;

    // Only restart timers when there's a NEW user message (real exchange)
    // If userMsgCount hasn't changed, this is a silence/interrupt message — don't restart
    if (userMsgCount <= lastUserMsgCount.current) return;

    lastUserMsgCount.current = userMsgCount;
    startSilenceTimers();

    return () => clearSilenceTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversationId, isStreaming, patient.id]);

  // Ctrl+Alt to toggle mic; double Ctrl+Alt to lock recording on
  const micLastPressRef = useRef<number>(0);
  const micLockedRef = useRef(false);
  const [micLocked, setMicLocked] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt combo (either order)
      if (e.ctrlKey && e.altKey && !e.repeat && sessionStarted && !isStreaming) {
        e.preventDefault();
        const now = Date.now();
        const timeSinceLast = now - micLastPressRef.current;
        micLastPressRef.current = now;

        if (isRecording) {
          // If recording → stop (and unlock if locked)
          micLockedRef.current = false;
          setMicLocked(false);
          stopRecording();
        } else {
          // Double press (< 500ms) → lock mode
          if (timeSinceLast < 500) {
            micLockedRef.current = true;
            setMicLocked(true);
          }
          startRecording();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const correctText = async () => {
    const currentText = input.trim();
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
        voiceAutoSendTimerRef.current = setTimeout(async () => {
          const textToSend = transcript.trim();
          if (textToSend && !isStreamingRef.current && sendMessageRef.current) {
            transcript = "";
            setInput("");
            // Stop recognition and prevent restart until send completes
            isStreamingRef.current = true;
            try { recognition.stop(); } catch {}
            // Auto-correct before sending (adds ¿? and tildes)
            try {
              const r = await fetch("/api/chat/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToSend }),
              });
              const data = r.ok ? await r.json() : null;
              const corrected = data?.corrected || textToSend;
              isStreamingRef.current = false;
              sendMessageRef.current(corrected);
            } catch {
              isStreamingRef.current = false;
              sendMessageRef.current(textToSend);
            }
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
    clearSilenceTimers();
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
        {/* Patient video avatar — clickable */}
        <button
          onClick={() => setShowVideoModal(true)}
          className="flex-shrink-0 rounded-full overflow-hidden bg-sidebar w-11 h-11 sm:w-14 sm:h-14"
        >
          <PatientVideo videoSrc={videoSrc} imageSrc={imageSrc} initials={initials} size={56} />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate text-sm sm:text-base">{patient.name}</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
            {patient.age} años, {patient.occupation}
          </p>
        </div>

        {/* Voice mode toggle + Session timer + End session button — hidden until session starts */}
        <div className={`flex items-center gap-2 sm:gap-3 flex-shrink-0 ${!sessionStarted ? "invisible" : ""}`}>
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

          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            title="Esto te permite volver en otro momento sin afectar la relaci\u00f3n con el paciente"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>
            <span className="hidden sm:inline">Pausar</span>
          </button>

          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Finalizar sesi&oacute;n</span>
            <span className="sm:hidden">Salir</span>
          </button>
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${messages.length === 0 ? "bg-gray-100" : displaySeconds >= 300 ? "bg-red-50" : "bg-amber-50"}`}>
                <LogOut size={20} className={messages.length === 0 ? "text-gray-400" : displaySeconds >= 300 ? "text-red-500" : "text-amber-500"} />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {messages.length === 0
                  ? "\u00bfSalir de la sesi\u00f3n?"
                  : displaySeconds >= 300
                    ? "\u00bfFinalizar sesi\u00f3n?"
                    : "Sesi\u00f3n con menos de 5 minutos"
                }
              </h3>
            </div>

            {messages.length === 0 ? (
              <p className="text-sm text-gray-600 leading-relaxed">
                A\u00fan no has enviado ning\u00fan mensaje. Si sales ahora, no se registrar\u00e1 nada.
              </p>
            ) : displaySeconds < 300 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-700 font-medium mb-1">
                  Si cierras ahora, no se generar\u00e1 evaluaci\u00f3n de competencias.
                </p>
                <p className="text-xs text-amber-600">
                  Para recibir retroalimentaci\u00f3n de la IA, necesitas al menos 5 minutos de conversaci\u00f3n y 6 intervenciones.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                La sesi\u00f3n se guardar\u00e1 y recibir\u00e1s una evaluaci\u00f3n de tus competencias cl\u00ednicas.
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={messages.length === 0 ? () => router.push("/dashboard") : handleEndSession}
                className={`end-session-btn flex-1 py-2.5 rounded-xl text-sm font-semibold ${
                  messages.length === 0
                    ? "bg-gray-500 text-white"
                    : displaySeconds >= 300
                      ? "bg-red-500 text-white"
                      : "bg-amber-500 text-white"
                }`}
              >
                {messages.length === 0
                  ? "S\u00ed, salir"
                  : displaySeconds >= 300
                    ? "S\u00ed, finalizar"
                    : "Cerrar sin evaluaci\u00f3n"
                }
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {messages.length === 0 ? "Quedarme" : "Continuar sesi\u00f3n"}
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

      {/* Mini tour for first-time users */}
      {showTour && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center pt-16" onClick={() => { setShowTour(false); localStorage.setItem("gloria_chat_tour_done", "1"); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm mx-4 p-5 animate-pop" onClick={(e) => e.stopPropagation()}>
            {tourStep === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sidebar/10 flex items-center justify-center">
                    <Clock size={18} className="text-sidebar" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Temporizador</p>
                    <p className="text-xs text-gray-500">Cuenta el tiempo de la sesi&oacute;n. Necesitas al menos 5 minutos para recibir evaluaci&oacute;n.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Pausar</p>
                    <p className="text-xs text-gray-500">Puedes salir y volver despu&eacute;s sin afectar la relaci&oacute;n con el paciente.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                    <LogOut size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Finalizar sesi&oacute;n</p>
                    <p className="text-xs text-gray-500">Cierra formalmente la sesi&oacute;n. Despu&eacute;s de 5 minutos recibir&aacute;s retroalimentaci&oacute;n.</p>
                  </div>
                </div>
              </div>
            )}
            {tourStep === 1 && (
              <div className="space-y-3">
                {patient.voice_id && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sidebar/10 flex items-center justify-center">
                      <Mic size={16} className="text-sidebar" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Modo voz</p>
                      <p className="text-xs text-gray-500">{"Este paciente soporta conversaci\u00f3n por voz. Activa el modo con el bot\u00f3n en la barra superior."}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-500">Shift</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Dictado por voz</p>
                    <p className="text-xs text-gray-500">{"Mant\u00e9n presionada la tecla Shift para dictar tu mensaje por voz."}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Clock size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Silencios</p>
                    <p className="text-xs text-gray-500">{"Si no respondes, el paciente reaccionar\u00e1 al silencio. Si pasan 5 minutos sin respuesta, se retirar\u00e1."}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <span className="text-[10px] text-gray-400">{tourStep + 1} de 2</span>
              {tourStep === 0 ? (
                <button onClick={() => setTourStep(1)} className="text-sm text-sidebar font-medium hover:underline">
                  Siguiente &rarr;
                </button>
              ) : (
                <button onClick={() => { setShowTour(false); localStorage.setItem("gloria_chat_tour_done", "1"); }} className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#354080] transition-colors">
                  Entendido
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 chat-pattern">
        {!sessionStarted && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-10 sm:mt-16 animate-fade-in px-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 max-w-md w-full">
              {/* Two avatars */}
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc} alt={patient.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">{patient.name}</p>
                  <p className="text-[11px] text-gray-500">{patient.age} {"a\u00f1os"}, {patient.occupation}</p>
                </div>

                <div className="w-10 h-px bg-gray-300 -mt-8" />

                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-sidebar/30 shadow-md bg-sidebar/10 flex items-center justify-center">
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-sidebar">{userInitials}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700">{"T\u00fa"}</p>
                  <p className="text-[11px] text-gray-500">Terapeuta</p>
                </div>
              </div>

              {/* Rules reminder */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Antes de comenzar, recuerda:</p>
                <ul className="text-[11px] text-gray-500 space-y-1.5">
                  <li className="flex gap-2"><span className="text-sidebar font-bold">1.</span> {"Esta es una simulaci\u00f3n con fines formativos, no una sesi\u00f3n real."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">2.</span> {"El paciente reacciona a tus intervenciones como lo har\u00eda en la vida real."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">3.</span> {"Intenta mantener al menos 5 minutos para recibir evaluaci\u00f3n."}</li>
                  <li className="flex gap-2"><span className="text-sidebar font-bold">4.</span> {"Puedes pausar y retomar la sesi\u00f3n en cualquier momento."}</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setSessionStarted(true);
                  if (!initialConvId && !localStorage.getItem("gloria_chat_tour_done")) {
                    setShowTour(true);
                    setTourStep(0);
                  }
                }}
                className="w-full bg-sidebar text-white py-3 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors"
              >
                {"Iniciar sesi\u00f3n"}
              </button>
            </div>
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

                {/* User avatar */}
                {msg.role === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-sidebar/20 flex items-center justify-center overflow-hidden">
                      {userAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-sidebar">{userInitials}</span>
                      )}
                    </div>
                  </div>
                )}
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
              <span className="inline-flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
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
            <span className="text-xs text-red-500 font-medium">
              {micLocked
                ? "Grabando audio (anclado) \u2014 Ctrl+Alt para detener"
                : "Grabando audio... Ctrl+Alt para detener"}
            </span>
          </div>
        )}
        {correcting && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-sidebar animate-pulse" />
            <span className="text-xs text-sidebar font-medium">Corrigiendo ortografía...</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                handleTypingActivity();
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 160) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder={sessionStarted ? "Escribe tu mensaje..." : "Presiona \"Iniciar sesi\u00f3n\" para comenzar"}
              rows={1}
              className="w-full resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar disabled:bg-gray-100 disabled:text-gray-400 overflow-hidden"
              disabled={!sessionStarted}
            />
            {input.trim().length > 10 && !correcting && !isStreaming && sessionStarted && (
              <button
                onClick={correctText}
                className="absolute right-2 bottom-1.5 text-[9px] text-gray-300 hover:text-sidebar font-medium transition-colors"
                title={"Corregir ortograf\u00eda"}
              >
                Abc
              </button>
            )}
            {correcting && (
              <span className="absolute right-2 bottom-1.5 text-[9px] text-sidebar animate-pulse">
                Corrigiendo...
              </span>
            )}
          </div>


          {/* Mic button (right side) */}
          <button
            onClick={toggleRecording}
            disabled={isStreaming}
            className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-colors flex-shrink-0 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "border border-gray-300 text-gray-500 hover:text-sidebar hover:border-sidebar/30"
            } disabled:opacity-50`}
            title={isRecording ? (micLocked ? "Anclado \u2014 Ctrl+Alt para detener" : "Ctrl+Alt para detener") : "Dictar por voz (Ctrl+Alt, doble para anclar)"}
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

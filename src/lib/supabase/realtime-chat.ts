/**
 * REALTIME CHAT — Supabase Realtime (WebSocket) for bidirectional communication
 *
 * Features:
 *   - Patient interruptions: reacts if therapist types too long without sending
 *   - Patient idle reactions: shorter intervals than the 5-min silence timer (90s)
 *   - Typing indicators: patient "sees" when therapist is typing
 *   - Server can push messages at any time through the channel
 */

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeEvent =
  | { type: "interrupt"; content: string }
  | { type: "typing"; isTyping: boolean }
  | { type: "reaction"; content: string };

type EventHandler = (event: RealtimeEvent) => void;

let _channel: RealtimeChannel | null = null;

/**
 * Subscribe to a conversation's realtime channel.
 * Returns unsubscribe function.
 */
export function subscribeToConversation(
  conversationId: string,
  onEvent: EventHandler
): () => void {
  // Clean up previous subscription
  if (_channel) {
    _channel.unsubscribe();
    _channel = null;
  }

  const supabase = createClient();
  _channel = supabase
    .channel(`chat:${conversationId}`, {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "patient_message" }, (payload) => {
      const data = payload.payload as RealtimeEvent;
      onEvent(data);
    })
    .subscribe();

  return () => {
    if (_channel) {
      _channel.unsubscribe();
      _channel = null;
    }
  };
}

/**
 * Broadcast typing indicator to the channel (therapist is typing).
 */
export function broadcastTyping(isTyping: boolean) {
  if (!_channel) return;
  _channel.send({
    type: "broadcast",
    event: "therapist_typing",
    payload: { isTyping },
  });
}

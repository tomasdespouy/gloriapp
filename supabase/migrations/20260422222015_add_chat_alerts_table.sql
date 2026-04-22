-- chat_alerts — automated supervision of therapy conversations.
--
-- Populated by src/app/api/chat/route.ts after each turn. Admins read
-- aggregated alerts in the pilot dashboard to review edge cases
-- without opening every conversation by hand.
--
-- This is NEVER used to interrupt a conversation. It is observational
-- only: we surface patterns (truncated LLM responses, profanity,
-- violence ideation, self-harm mentions, disrespect) so the team can
-- audit quality and student safety after the fact.

CREATE TABLE IF NOT EXISTS public.chat_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_patient_id UUID REFERENCES public.ai_patients(id) ON DELETE SET NULL,

  -- Which side of the conversation produced the content that triggered
  -- the alert. "user" = student's message, "assistant" = AI patient's
  -- response.
  source TEXT NOT NULL CHECK (source IN ('user', 'assistant')),

  -- Category of the pattern detected. Keep this list tight — new kinds
  -- should be added with migrations, not strings inserted ad-hoc.
  kind TEXT NOT NULL CHECK (kind IN (
    'short_response',
    'profanity',
    'violence',
    'self_harm',
    'disrespect',
    'prompt_leak'
  )),

  -- Low: informational. Medium: worth reviewing. High: worth escalating
  -- quickly. Critical: direct risk (e.g. self-harm language from the
  -- student in first person). Computed by the detector at insert time.
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- The terms that matched the detector (comma-separated) so admins can
  -- see WHY the alert fired without having to guess.
  matched_terms TEXT,

  -- Short snippet of the message for quick scanning. Full content is
  -- in the messages table via message_id.
  sample TEXT,

  -- Turn number (from clinical_state_log.turn_number) so admins can
  -- navigate quickly to that point in the transcript.
  turn_number INT,

  -- Optional: human review metadata. Alerts can be marked as reviewed
  -- so the admin doesn't see the same event twice.
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the dashboard queries:
--   · list alerts for a pilot → join through conversations
--   · list pending alerts (reviewed_at IS NULL)
--   · group by student in the pilot
CREATE INDEX IF NOT EXISTS idx_chat_alerts_conversation ON public.chat_alerts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_alerts_student ON public.chat_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_alerts_unreviewed ON public.chat_alerts(created_at DESC) WHERE reviewed_at IS NULL;

-- RLS: only superadmins read. Writes come from the service_role key
-- inside chat/route.ts, which bypasses RLS.
ALTER TABLE public.chat_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view chat alerts"
  ON public.chat_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can update chat alerts (review)"
  ON public.chat_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'superadmin'
    )
  );

COMMENT ON TABLE public.chat_alerts IS
  'Observational alerts from chat turns (short LLM responses, profanity, violence, self-harm, disrespect). Never interrupts a conversation — only surfaces patterns to the admin dashboard.';

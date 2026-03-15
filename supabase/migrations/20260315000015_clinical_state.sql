-- ============================================================
-- MOTOR ADAPTATIVO DE ESTADO CLÍNICO
-- Tracks patient internal state variables per conversation turn
-- ============================================================

-- State snapshots: one row per turn in a conversation
CREATE TABLE public.clinical_state_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  turn_number       INTEGER NOT NULL,

  -- What the therapist did (classified)
  intervention_type TEXT NOT NULL,
  intervention_raw  TEXT NOT NULL,

  -- Patient state AFTER this intervention
  resistencia       NUMERIC(3,1) NOT NULL DEFAULT 7.0,
  alianza           NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  apertura_emocional NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  sintomatologia    NUMERIC(3,1) NOT NULL DEFAULT 7.0,
  disposicion_cambio NUMERIC(3,1) NOT NULL DEFAULT 2.0,

  -- Delta: how much each variable changed
  delta_resistencia       NUMERIC(3,1) DEFAULT 0,
  delta_alianza           NUMERIC(3,1) DEFAULT 0,
  delta_apertura          NUMERIC(3,1) DEFAULT 0,
  delta_sintomatologia    NUMERIC(3,1) DEFAULT 0,
  delta_disposicion       NUMERIC(3,1) DEFAULT 0,

  -- Patient response generated with this state
  patient_response  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinical_state_conversation ON public.clinical_state_log(conversation_id);

ALTER TABLE public.clinical_state_log ENABLE ROW LEVEL SECURITY;

-- Students see own, instructors/admins see all
CREATE POLICY "Students view own clinical state"
  ON public.clinical_state_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.student_id = auth.uid()
  ));

CREATE POLICY "Instructors view all clinical state"
  ON public.clinical_state_log FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

-- System can insert (via service role)
CREATE POLICY "System insert clinical state"
  ON public.clinical_state_log FOR INSERT TO authenticated
  WITH CHECK (true);

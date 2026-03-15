-- ============================================================
-- ACCIONABLES: Acuerdos mutuos docente ↔ estudiante
-- ============================================================

CREATE TABLE public.action_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES public.profiles(id),
  content         TEXT NOT NULL,
  resource_link   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected')),
  student_comment TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ
);

CREATE INDEX idx_action_items_student ON public.action_items(student_id);
CREATE INDEX idx_action_items_conversation ON public.action_items(conversation_id);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- Students see and update own
CREATE POLICY "Students view own action items"
  ON public.action_items FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students update own action items"
  ON public.action_items FOR UPDATE TO authenticated
  USING (auth.uid() = student_id);

-- Instructors CRUD
CREATE POLICY "Instructors manage action items"
  ON public.action_items FOR ALL TO authenticated
  USING (public.is_instructor_or_above())
  WITH CHECK (public.is_instructor_or_above());

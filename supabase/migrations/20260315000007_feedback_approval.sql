-- ============================================================
-- FEEDBACK APPROVAL FLOW
-- Students can't see AI evaluation until teacher approves
-- ============================================================

-- Add approval status to session_competencies
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS feedback_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (feedback_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  href        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Instructors/admins can insert notifications for students
CREATE POLICY "Instructors insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_instructor_or_above());

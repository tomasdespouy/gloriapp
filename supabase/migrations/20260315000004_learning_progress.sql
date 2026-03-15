-- ============================================================
-- LEARNING PROGRESS: track which examples a student has read
-- ============================================================

CREATE TABLE public.learning_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  example_id  TEXT NOT NULL,
  competency  TEXT NOT NULL,
  xp_awarded  INTEGER NOT NULL DEFAULT 10,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, example_id)
);

CREATE INDEX idx_learning_progress_student ON public.learning_progress(student_id);

ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own learning progress"
  ON public.learning_progress FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Instructors and admins can view
CREATE POLICY "Instructors view learning progress"
  ON public.learning_progress FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

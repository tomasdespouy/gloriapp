-- Add teacher evaluation fields to session_feedback
ALTER TABLE public.session_feedback
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS teacher_comment TEXT,
  ADD COLUMN IF NOT EXISTS teacher_score NUMERIC(3,1);

-- Allow instructors to update feedback with their evaluation
CREATE POLICY "Instructors can update feedback with evaluation"
  ON public.session_feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'instructor'
    )
  );

-- Allow instructors to view all feedback
CREATE POLICY "Instructors can view all feedback"
  ON public.session_feedback FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'instructor'
    )
  );

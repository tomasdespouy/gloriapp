-- ============================================================
-- INSTRUCTOR ACCESS: allow instructors to read student data
-- ============================================================

-- Instructors can view all profiles (to see student list)
CREATE POLICY "Instructors can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all conversations
CREATE POLICY "Instructors can view all conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all messages
CREATE POLICY "Instructors can view all messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all student progress
CREATE POLICY "Instructors can view all student progress"
  ON public.student_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all session competencies
CREATE POLICY "Instructors can view all session competencies"
  ON public.session_competencies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all student achievements
CREATE POLICY "Instructors can view all student achievements"
  ON public.student_achievements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all message annotations
CREATE POLICY "Instructors can view all message annotations"
  ON public.message_annotations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can view all AI patients (including inactive)
CREATE POLICY "Instructors can view all patients"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

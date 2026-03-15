-- ============================================================
-- FIX: Instructor RLS policies also cause infinite recursion
-- on profiles table. Replace inline sub-queries with
-- get_my_role() SECURITY DEFINER function.
-- ============================================================

-- Helper: is current user an instructor (or above)?
CREATE OR REPLACE FUNCTION public.is_instructor_or_above()
RETURNS BOOLEAN AS $$
DECLARE
  r TEXT;
BEGIN
  r := public.get_my_role();
  RETURN r IN ('instructor', 'admin', 'superadmin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Fix instructor policies on profiles (cause recursion)
-- ============================================================

DROP POLICY IF EXISTS "Instructors can view all profiles" ON public.profiles;
CREATE POLICY "Instructors can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('instructor', 'admin', 'superadmin'));

-- ============================================================
-- Fix instructor policies on other tables (sub-query profiles)
-- ============================================================

DROP POLICY IF EXISTS "Instructors can view all conversations" ON public.conversations;
CREATE POLICY "Instructors can view all conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all messages" ON public.messages;
CREATE POLICY "Instructors can view all messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all student progress" ON public.student_progress;
CREATE POLICY "Instructors can view all student progress"
  ON public.student_progress FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all session competencies" ON public.session_competencies;
CREATE POLICY "Instructors can view all session competencies"
  ON public.session_competencies FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all student achievements" ON public.student_achievements;
CREATE POLICY "Instructors can view all student achievements"
  ON public.student_achievements FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all message annotations" ON public.message_annotations;
CREATE POLICY "Instructors can view all message annotations"
  ON public.message_annotations FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all patients" ON public.ai_patients;
CREATE POLICY "Instructors can view all patients"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

-- ============================================================
-- Fix teacher evaluation policy (also sub-queries profiles)
-- ============================================================

DROP POLICY IF EXISTS "Instructors can update feedback with evaluation" ON public.session_feedback;
CREATE POLICY "Instructors can update feedback with evaluation"
  ON public.session_feedback FOR UPDATE TO authenticated
  USING (public.is_instructor_or_above());

DROP POLICY IF EXISTS "Instructors can view all feedback" ON public.session_feedback;
CREATE POLICY "Instructors can view all feedback"
  ON public.session_feedback FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_instructor_or_above()
  );

-- ============================================================
-- SECURITY FIX: Remove overly permissive RLS policies
--
-- session_summaries: "Service role full access" used USING(true)/WITH CHECK(true)
--   → Any authenticated user could read/write/delete ALL summaries
-- clinical_state_log: "System insert" used WITH CHECK(true)
--   → Any authenticated user could insert fake clinical state records
-- system_metrics: "System insert" used WITH CHECK(true)
--   → Any authenticated user could poison system metrics
--
-- Service role already bypasses RLS, so these policies are unnecessary.
-- For session_summaries, we add a proper INSERT policy scoped to the student.
-- ============================================================

-- 1. session_summaries: remove the wide-open policy
DROP POLICY IF EXISTS "Service role full access on summaries" ON session_summaries;

-- Add scoped INSERT policy: students can insert summaries for their own conversations
CREATE POLICY "Students insert own summaries"
  ON session_summaries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Add scoped UPDATE policy: students can update their own summaries
CREATE POLICY "Students update own summaries"
  ON session_summaries FOR UPDATE TO authenticated
  USING (auth.uid() = student_id);

-- Instructors and above can view all summaries (for review)
CREATE POLICY "Instructors view all summaries"
  ON session_summaries FOR SELECT TO authenticated
  USING (public.is_instructor_or_above());

-- 2. clinical_state_log: remove the wide-open INSERT policy
DROP POLICY IF EXISTS "System insert clinical state" ON public.clinical_state_log;

-- Scoped INSERT: only for conversations owned by the authenticated user
CREATE POLICY "Students insert own clinical state"
  ON public.clinical_state_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.student_id = auth.uid()
    )
  );

-- 3. system_metrics: remove the wide-open INSERT policy
DROP POLICY IF EXISTS "System insert metrics" ON public.system_metrics;

-- No authenticated user needs to insert metrics directly.
-- All metric inserts go through service_role (server-side logger).

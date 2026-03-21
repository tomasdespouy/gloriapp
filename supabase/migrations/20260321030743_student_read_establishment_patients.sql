-- ============================================================================
-- Fix: Allow students and instructors to read establishment_patients
-- ============================================================================
-- The ai_patients RLS policies use an EXISTS subquery against
-- establishment_patients. Without a SELECT policy for students/instructors,
-- that subquery always returns empty — making explicit assignments invisible.
-- ============================================================================

CREATE POLICY "Student read own establishment patients"
  ON public.establishment_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('student', 'instructor')
    AND establishment_id = ANY(public.get_my_establishment_ids())
  );

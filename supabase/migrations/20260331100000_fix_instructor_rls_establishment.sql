-- ============================================================
-- SECURITY FIX H-03: Instructor RLS scoped by establishment_id
--
-- BEFORE: Instructors could view ALL data across ALL establishments
-- AFTER: Instructors can only view data within their own establishment
-- ============================================================

-- Helper function: get the caller's establishment_id (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_establishment_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT establishment_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- DROP all old instructor policies (unscoped)
-- ============================================================
DROP POLICY IF EXISTS "Instructors can view all profiles"           ON public.profiles;
DROP POLICY IF EXISTS "Instructors can view all conversations"      ON public.conversations;
DROP POLICY IF EXISTS "Instructors can view all messages"           ON public.messages;
DROP POLICY IF EXISTS "Instructors can view all student progress"   ON public.student_progress;
DROP POLICY IF EXISTS "Instructors can view all session competencies" ON public.session_competencies;
DROP POLICY IF EXISTS "Instructors can view all student achievements" ON public.student_achievements;
DROP POLICY IF EXISTS "Instructors can view all message annotations"  ON public.message_annotations;
DROP POLICY IF EXISTS "Instructors can view all patients"           ON public.ai_patients;

-- ============================================================
-- CREATE new scoped policies
-- ============================================================

-- Profiles: instructors see users in their establishment only
CREATE POLICY "Instructors view establishment profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      -- Same establishment
      establishment_id = public.get_my_establishment_id()
      -- OR the viewer is admin/superadmin (they have their own broader policies)
      OR public.is_admin_or_superadmin()
    )
  );

-- Conversations: instructors see conversations from students in their establishment
CREATE POLICY "Instructors view establishment conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = student_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

-- Messages: instructors see messages from conversations in their establishment
CREATE POLICY "Instructors view establishment messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.profiles p ON p.id = c.student_id
        WHERE c.id = conversation_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

-- Student progress: instructors see progress of students in their establishment
CREATE POLICY "Instructors view establishment student progress"
  ON public.student_progress FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = student_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

-- Session competencies: instructors see competencies of students in their establishment
CREATE POLICY "Instructors view establishment session competencies"
  ON public.session_competencies FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = student_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

-- Student achievements: instructors see achievements of students in their establishment
CREATE POLICY "Instructors view establishment student achievements"
  ON public.student_achievements FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = student_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

-- Message annotations: instructors see annotations from conversations in their establishment
CREATE POLICY "Instructors view establishment message annotations"
  ON public.message_annotations FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        JOIN public.profiles p ON p.id = c.student_id
        WHERE m.id = message_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

-- AI patients: instructors see patients matching their establishment's country OR explicitly assigned
-- (This replaces the blanket "view all patients" policy)
CREATE POLICY "Instructors view patients by country or assignment"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above()
    AND (
      country && public.get_my_countries()
      OR EXISTS (
        SELECT 1 FROM public.establishment_patients ep
        WHERE ep.ai_patient_id = id
        AND ep.establishment_id = ANY(public.get_my_establishment_ids())
      )
      OR public.is_admin_or_superadmin()
    )
  );

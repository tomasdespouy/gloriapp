-- ============================================================
-- FIX: RLS infinite recursion on profiles table
-- The is_superadmin() and admin policies were querying profiles
-- from within profiles policies, causing infinite recursion.
-- Solution: use a SECURITY DEFINER function that bypasses RLS.
-- ============================================================

-- Function to get current user's role bypassing RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Rewrite is_superadmin using get_my_role (no recursion)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_my_role() = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_my_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: is admin or superadmin?
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
  r TEXT;
BEGIN
  r := public.get_my_role();
  RETURN r = 'admin' OR r = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- DROP and re-create profiles policies that caused recursion
-- ============================================================

DROP POLICY IF EXISTS "Superadmin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view establishment profiles" ON public.profiles;

-- Superadmin can view all profiles (uses get_my_role, no recursion)
CREATE POLICY "Superadmin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.get_my_role() = 'superadmin');

-- Superadmin can update all profiles
CREATE POLICY "Superadmin can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'superadmin');

-- Admin can view profiles in their establishments
CREATE POLICY "Admin can view establishment profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'admin'
    AND establishment_id IN (
      SELECT ae.establishment_id FROM public.admin_establishments ae
      WHERE ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- Fix admin policies on other tables that sub-query profiles
-- ============================================================

-- CONVERSATIONS
DROP POLICY IF EXISTS "Admin can view establishment conversations" ON public.conversations;
CREATE POLICY "Admin can view establishment conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = conversations.student_id AND ae.admin_id = auth.uid()
    )
  );

-- MESSAGES
DROP POLICY IF EXISTS "Admin can view establishment messages" ON public.messages;
CREATE POLICY "Admin can view establishment messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.profiles student ON student.id = c.student_id
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE c.id = messages.conversation_id AND ae.admin_id = auth.uid()
    )
  );

-- STUDENT_PROGRESS
DROP POLICY IF EXISTS "Admin can view establishment student progress" ON public.student_progress;
CREATE POLICY "Admin can view establishment student progress"
  ON public.student_progress FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = student_progress.student_id AND ae.admin_id = auth.uid()
    )
  );

-- SESSION_COMPETENCIES
DROP POLICY IF EXISTS "Admin can view establishment session competencies" ON public.session_competencies;
CREATE POLICY "Admin can view establishment session competencies"
  ON public.session_competencies FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = session_competencies.student_id AND ae.admin_id = auth.uid()
    )
  );

-- STUDENT_ACHIEVEMENTS
DROP POLICY IF EXISTS "Admin can view establishment student achievements" ON public.student_achievements;
CREATE POLICY "Admin can view establishment student achievements"
  ON public.student_achievements FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = student_achievements.student_id AND ae.admin_id = auth.uid()
    )
  );

-- SESSION_FEEDBACK
DROP POLICY IF EXISTS "Admin can view establishment session feedback" ON public.session_feedback;
CREATE POLICY "Admin can view establishment session feedback"
  ON public.session_feedback FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = session_feedback.student_id AND ae.admin_id = auth.uid()
    )
  );

-- AI_PATIENTS
DROP POLICY IF EXISTS "Admin can view all patients" ON public.ai_patients;
CREATE POLICY "Admin can view all patients"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (public.is_admin());

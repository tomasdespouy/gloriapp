-- ============================================================
-- SECURITY FIX: scope feedback-flow tables by establishment_id
--
-- The H-03 fix (20260331100000_fix_instructor_rls_establishment.sql)
-- scoped instructor SELECT policies by establishment for 8 tables,
-- but missed three tables in the feedback flow:
--   • session_feedback  (SELECT + UPDATE)
--   • action_items      (FOR ALL)
--   • notifications     (INSERT)
--
-- Those kept their blanket "any instructor" policies, so an instructor
-- from establishment A could read/edit the private reflection + teacher
-- comment of a student in establishment B (session_feedback), CRUD their
-- action items, or inject notifications to any user — directly via the
-- PostgREST API with their own token. The app itself writes these tables
-- with the service-role (admin) client, so it never relied on these
-- instructor policies; this change only closes the PostgREST hole.
--
-- Reuses the SECURITY DEFINER helpers defined in earlier migrations:
--   get_my_establishment_id()  (20260331100000)
--   is_instructor_or_above()   (20260315000003)
--   is_admin_or_superadmin()   (20260315000002)
--
-- Student / admin / superadmin policies are left untouched. Admins and
-- superadmins keep their broader access through the OR branch.
-- ============================================================

-- ── session_feedback: SELECT scoped to own establishment ──────────────
DROP POLICY IF EXISTS "Instructors can view all feedback"     ON public.session_feedback;
DROP POLICY IF EXISTS "Instructors view establishment feedback" ON public.session_feedback;
CREATE POLICY "Instructors view establishment feedback"
  ON public.session_feedback FOR SELECT TO authenticated
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

-- ── session_feedback: UPDATE scoped to own establishment ──────────────
DROP POLICY IF EXISTS "Instructors can update feedback with evaluation" ON public.session_feedback;
DROP POLICY IF EXISTS "Instructors update establishment feedback"       ON public.session_feedback;
CREATE POLICY "Instructors update establishment feedback"
  ON public.session_feedback FOR UPDATE TO authenticated
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
  )
  WITH CHECK (
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

-- ── action_items: ALL (SELECT/INSERT/UPDATE/DELETE) scoped ────────────
DROP POLICY IF EXISTS "Instructors manage action items"               ON public.action_items;
DROP POLICY IF EXISTS "Instructors manage establishment action items" ON public.action_items;
CREATE POLICY "Instructors manage establishment action items"
  ON public.action_items FOR ALL TO authenticated
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
  )
  WITH CHECK (
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

-- ── notifications: INSERT scoped to recipients in own establishment ───
DROP POLICY IF EXISTS "Instructors insert notifications"               ON public.notifications;
DROP POLICY IF EXISTS "Instructors insert establishment notifications" ON public.notifications;
CREATE POLICY "Instructors insert establishment notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_instructor_or_above()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id
        AND p.establishment_id = public.get_my_establishment_id()
      )
      OR public.is_admin_or_superadmin()
    )
  );

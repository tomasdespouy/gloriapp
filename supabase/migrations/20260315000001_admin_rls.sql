-- ============================================================
-- ADMIN & SUPERADMIN RLS POLICIES
-- ============================================================

-- Helper: check if current user is admin for a given establishment
CREATE OR REPLACE FUNCTION public.is_admin_for_establishment(est_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_establishments
    WHERE admin_id = auth.uid() AND establishment_id = est_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if current user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- ESTABLISHMENTS POLICIES
-- ============================================================

-- Superadmin: full CRUD
CREATE POLICY "Superadmin full access on establishments"
  ON public.establishments FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Admin: read only assigned establishments
CREATE POLICY "Admin read assigned establishments"
  ON public.establishments FOR SELECT TO authenticated
  USING (public.is_admin_for_establishment(id));

-- ============================================================
-- ADMIN_ESTABLISHMENTS POLICIES
-- ============================================================

-- Superadmin: full CRUD
CREATE POLICY "Superadmin full access on admin_establishments"
  ON public.admin_establishments FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Admin: can see own assignments
CREATE POLICY "Admin view own assignments"
  ON public.admin_establishments FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

-- ============================================================
-- PROFILES: admin/superadmin access
-- ============================================================

-- Superadmin can view all profiles
CREATE POLICY "Superadmin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- Superadmin can update all profiles
CREATE POLICY "Superadmin can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_superadmin());

-- Admin can view profiles in their establishments
CREATE POLICY "Admin can view establishment profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND (
      establishment_id IN (
        SELECT ae.establishment_id FROM public.admin_establishments ae
        WHERE ae.admin_id = auth.uid()
      )
    )
  );

-- ============================================================
-- CONVERSATIONS: admin/superadmin access
-- ============================================================

-- Superadmin can view all conversations
CREATE POLICY "Superadmin can view all conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- Admin can view conversations from their establishments
CREATE POLICY "Admin can view establishment conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = conversations.student_id AND ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- MESSAGES: admin/superadmin access
-- ============================================================

CREATE POLICY "Superadmin can view all messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Admin can view establishment messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.profiles student ON student.id = c.student_id
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE c.id = messages.conversation_id AND ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- STUDENT_PROGRESS: admin/superadmin access
-- ============================================================

CREATE POLICY "Superadmin can view all student progress"
  ON public.student_progress FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Admin can view establishment student progress"
  ON public.student_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = student_progress.student_id AND ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- SESSION_COMPETENCIES: admin/superadmin access
-- ============================================================

CREATE POLICY "Superadmin can view all session competencies"
  ON public.session_competencies FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Admin can view establishment session competencies"
  ON public.session_competencies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = session_competencies.student_id AND ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- STUDENT_ACHIEVEMENTS: admin/superadmin access
-- ============================================================

CREATE POLICY "Superadmin can view all student achievements"
  ON public.student_achievements FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Admin can view establishment student achievements"
  ON public.student_achievements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = student_achievements.student_id AND ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- SESSION_FEEDBACK: admin/superadmin access
-- ============================================================

CREATE POLICY "Superadmin can view all session feedback"
  ON public.session_feedback FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Admin can view establishment session feedback"
  ON public.session_feedback FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      JOIN public.admin_establishments ae ON ae.establishment_id = student.establishment_id
      WHERE student.id = session_feedback.student_id AND ae.admin_id = auth.uid()
    )
  );

-- ============================================================
-- AI_PATIENTS: admin/superadmin full access
-- ============================================================

CREATE POLICY "Superadmin full access on ai_patients"
  ON public.ai_patients FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Admin can view all patients"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

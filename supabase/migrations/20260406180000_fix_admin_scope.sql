-- ============================================================
-- SECURITY FIX: Restrict admin role to its own establishments
--
-- BEFORE: admin role could view ALL patients, ALL surveys and ALL
-- survey responses across the entire platform — equivalent to
-- superadmin in those areas.
--
-- AFTER: admin sees only data scoped to their assigned establishments
-- via admin_establishments. Superadmin retains global access through
-- separate policies that already exist.
-- ============================================================

-- ─── 1. ai_patients ────────────────────────────────────────
-- Replace the wide-open admin policy with a scoped one.
-- Admin can SELECT patients assigned to their establishments via
-- establishment_patients. Superadmin keeps full access through the
-- existing "Superadmin full access on ai_patients" policy.

DROP POLICY IF EXISTS "Admin can view all patients" ON public.ai_patients;

CREATE POLICY "Admin view scoped patients"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.establishment_patients ep
      WHERE ep.ai_patient_id = id
        AND ep.establishment_id = ANY(public.get_my_establishment_ids())
    )
  );

-- ─── 2. surveys ───────────────────────────────────────────
-- Replace the wide-open "Admins manage surveys" (FOR ALL) with two
-- policies: superadmin keeps full CRUD; admin only gets SELECT scoped
-- to global surveys + surveys for their establishments.

DROP POLICY IF EXISTS "Admins manage surveys" ON public.surveys;

CREATE POLICY "Superadmin manage all surveys"
  ON public.surveys FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- NOTE: surveys.scope_id is TEXT (not UUID) because it can hold different
-- kinds of ids depending on scope_type. We compare against admin_establishments
-- via an EXISTS with an explicit ::text cast, which is safe regardless of
-- whether scope_id contains a UUID-shaped string or something else.
CREATE POLICY "Admin view scoped surveys"
  ON public.surveys FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND (
      scope_type = 'global'
      OR (
        scope_type = 'establishment'
        AND EXISTS (
          SELECT 1 FROM public.admin_establishments ae
          WHERE ae.admin_id = auth.uid()
            AND ae.establishment_id::text = scope_id
        )
      )
    )
  );

-- (The existing policy "All users view active surveys" remains untouched
--  so end users can still see surveys that target them.)

-- ─── 3. survey_responses ───────────────────────────────────
-- Replace the wide-open "Admins view all responses" with a scoped policy
-- that limits admin to responses from users of their establishments.

DROP POLICY IF EXISTS "Admins view all responses" ON public.survey_responses;

CREATE POLICY "Superadmin view all responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Admin view scoped responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles caller
      WHERE caller.id = auth.uid() AND caller.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.id = survey_responses.user_id
        AND target.establishment_id = ANY(public.get_my_establishment_ids())
    )
  );

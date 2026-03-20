-- ============================================================================
-- Migration: Restrict ai_patients visibility by establishment country
-- ============================================================================
-- Hierarchy:
--   supradmin  → sees ALL patients (existing policy kept)
--   admin      → sees patients matching their establishments' countries
--   instructor → sees patients matching their establishment's country
--   student    → sees only ACTIVE patients matching their establishment's country
-- Fallback: no establishment assigned = no patients visible
-- ============================================================================

-- Step 1: Helper function — returns array of countries the current user can see
CREATE OR REPLACE FUNCTION public.get_my_countries()
RETURNS TEXT[] AS $$
DECLARE
  my_role TEXT;
  result TEXT[];
BEGIN
  my_role := public.get_my_role();

  IF my_role = 'admin' THEN
    -- Admin: aggregate countries from all their assigned establishments
    SELECT ARRAY_AGG(DISTINCT e.country)
    INTO result
    FROM public.admin_establishments ae
    JOIN public.establishments e ON e.id = ae.establishment_id
    WHERE ae.admin_id = auth.uid() AND e.country IS NOT NULL;
    RETURN COALESCE(result, ARRAY[]::TEXT[]);
  ELSE
    -- Instructor / Student: single establishment from profiles
    SELECT ARRAY[e.country]
    INTO result
    FROM public.profiles p
    JOIN public.establishments e ON e.id = p.establishment_id
    WHERE p.id = auth.uid() AND e.country IS NOT NULL;
    RETURN COALESCE(result, ARRAY[]::TEXT[]);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 2: Drop old overly-permissive policies
DROP POLICY IF EXISTS "View active patients"              ON public.ai_patients;
DROP POLICY IF EXISTS "Admin can view all patients"       ON public.ai_patients;
DROP POLICY IF EXISTS "Instructors can view all patients" ON public.ai_patients;

-- Step 3: Create new country-scoped policies
-- (Superadmin already has "Superadmin full access on ai_patients" — no change)

-- Admin: sees active + inactive patients for their establishments' countries
CREATE POLICY "Admin view patients by country"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'admin'
    AND ai_patients.country && public.get_my_countries()
  );

-- Instructor/Docente: sees active + inactive patients for their establishment's country
CREATE POLICY "Instructor view patients by country"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'instructor'
    AND ai_patients.country && public.get_my_countries()
  );

-- Student: sees only ACTIVE patients for their establishment's country
CREATE POLICY "Student view active patients by country"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND is_active = TRUE
    AND ai_patients.country && public.get_my_countries()
  );

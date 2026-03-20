-- ============================================================================
-- Migration: Explicit patient assignment per establishment (premium model)
-- ============================================================================
-- Supradmin can assign specific patients to an establishment beyond the
-- default country-based visibility. This enables a tiered access model:
--   - Default (free): patients matching the establishment's country
--   - Premium: supradmin explicitly grants additional patients
-- ============================================================================

-- Step 1: Create junction table
CREATE TABLE public.establishment_patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  ai_patient_id     UUID NOT NULL REFERENCES public.ai_patients(id) ON DELETE CASCADE,
  granted_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(establishment_id, ai_patient_id)
);

CREATE INDEX idx_establishment_patients_est ON public.establishment_patients(establishment_id);
CREATE INDEX idx_establishment_patients_patient ON public.establishment_patients(ai_patient_id);

ALTER TABLE public.establishment_patients ENABLE ROW LEVEL SECURITY;

-- Only superadmin can manage establishment_patients
CREATE POLICY "Superadmin full access on establishment_patients"
  ON public.establishment_patients FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Admin can view assignments for their establishments
CREATE POLICY "Admin view establishment_patients"
  ON public.establishment_patients FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND public.is_admin_for_establishment(establishment_id)
  );

-- Step 2: Helper function — returns establishment IDs for current user
CREATE OR REPLACE FUNCTION public.get_my_establishment_ids()
RETURNS UUID[] AS $$
DECLARE
  my_role TEXT;
  result UUID[];
BEGIN
  my_role := public.get_my_role();

  IF my_role = 'admin' THEN
    SELECT ARRAY_AGG(ae.establishment_id)
    INTO result
    FROM public.admin_establishments ae
    WHERE ae.admin_id = auth.uid();
    RETURN COALESCE(result, ARRAY[]::UUID[]);
  ELSE
    SELECT ARRAY[p.establishment_id]
    INTO result
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.establishment_id IS NOT NULL;
    RETURN COALESCE(result, ARRAY[]::UUID[]);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Update RLS policies on ai_patients to include explicit assignments
-- Drop the policies created in the previous migration
DROP POLICY IF EXISTS "Admin view patients by country" ON public.ai_patients;
DROP POLICY IF EXISTS "Instructor view patients by country" ON public.ai_patients;
DROP POLICY IF EXISTS "Student view active patients by country" ON public.ai_patients;

-- Admin: country match OR explicit assignment
CREATE POLICY "Admin view patients by country or assignment"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'admin'
    AND (
      ai_patients.country && public.get_my_countries()
      OR EXISTS (
        SELECT 1 FROM public.establishment_patients ep
        WHERE ep.ai_patient_id = ai_patients.id
        AND ep.establishment_id = ANY(public.get_my_establishment_ids())
      )
    )
  );

-- Instructor: country match OR explicit assignment
CREATE POLICY "Instructor view patients by country or assignment"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'instructor'
    AND (
      ai_patients.country && public.get_my_countries()
      OR EXISTS (
        SELECT 1 FROM public.establishment_patients ep
        WHERE ep.ai_patient_id = ai_patients.id
        AND ep.establishment_id = ANY(public.get_my_establishment_ids())
      )
    )
  );

-- Student: ACTIVE + country match OR explicit assignment
CREATE POLICY "Student view active patients by country or assignment"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'student'
    AND is_active = TRUE
    AND (
      ai_patients.country && public.get_my_countries()
      OR EXISTS (
        SELECT 1 FROM public.establishment_patients ep
        WHERE ep.ai_patient_id = ai_patients.id
        AND ep.establishment_id = ANY(public.get_my_establishment_ids())
      )
    )
  );

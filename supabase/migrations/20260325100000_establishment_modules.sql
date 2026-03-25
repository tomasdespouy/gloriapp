-- ============================================================
-- ESTABLISHMENT MODULES: toggleable features per institution
-- Opt-out model: if no row exists, module is enabled by default.
-- Only explicitly disabled modules (is_active = false) are hidden.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.establishment_modules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  module_key        TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(establishment_id, module_key)
);

-- Auto-update updated_at
CREATE TRIGGER set_establishment_modules_updated_at
  BEFORE UPDATE ON public.establishment_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_establishment_modules_est ON public.establishment_modules(establishment_id);

-- RLS
ALTER TABLE public.establishment_modules ENABLE ROW LEVEL SECURITY;

-- Superadmin: full CRUD
CREATE POLICY "Superadmin full access on establishment_modules"
  ON public.establishment_modules FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Admin: read modules for their establishments
CREATE POLICY "Admin view establishment_modules"
  ON public.establishment_modules FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND public.is_admin_for_establishment(establishment_id)
  );

-- Students/Instructors: read modules for their own establishment
CREATE POLICY "User view own establishment modules"
  ON public.establishment_modules FOR SELECT TO authenticated
  USING (
    establishment_id IN (
      SELECT p.establishment_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.establishment_id IS NOT NULL
    )
  );

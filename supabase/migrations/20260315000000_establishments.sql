-- ============================================================
-- ESTABLISHMENTS + SUPERADMIN ROLE
-- ============================================================

-- Table: establishments
CREATE TABLE public.establishments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_establishments_updated_at
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

-- Add establishment_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL;

-- Expand role CHECK to include superadmin
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'instructor', 'admin', 'superadmin'));

-- Update handle_new_user to accept establishment_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, establishment_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    CASE
      WHEN NEW.raw_user_meta_data->>'establishment_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'establishment_id')::UUID
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Many-to-many: admin ↔ establishment
CREATE TABLE public.admin_establishments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  establishment_id  UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_id, establishment_id)
);

ALTER TABLE public.admin_establishments ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX idx_profiles_establishment ON public.profiles(establishment_id);
CREATE INDEX idx_admin_establishments_admin ON public.admin_establishments(admin_id);
CREATE INDEX idx_admin_establishments_est ON public.admin_establishments(establishment_id);

-- ============================================================
-- COURSES (Asignaturas) & SECTIONS (Secciones)
-- Jerarquía: Institución → Asignatura → Sección
-- ============================================================

-- Asignaturas (pertenecen a un establecimiento)
CREATE TABLE public.courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_establishment ON public.courses(establishment_id);

CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Secciones (pertenecen a una asignatura)
CREATE TABLE public.sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sections_course ON public.sections(course_id);

CREATE TRIGGER set_sections_updated_at
  BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Agregar course_id y section_id a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_course ON public.profiles(course_id);
CREATE INDEX idx_profiles_section ON public.profiles(section_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Courses: superadmin CRUD, admin/instructor read assigned
CREATE POLICY "Superadmin full access on courses"
  ON public.courses FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Admin read courses in their establishments"
  ON public.courses FOR SELECT TO authenticated
  USING (
    public.is_admin() AND establishment_id IN (
      SELECT ae.establishment_id FROM public.admin_establishments ae WHERE ae.admin_id = auth.uid()
    )
  );

CREATE POLICY "Instructor read own courses"
  ON public.courses FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above() AND establishment_id IN (
      SELECT p.establishment_id FROM public.profiles p WHERE p.id = auth.uid() AND p.establishment_id IS NOT NULL
    )
  );

-- Sections: superadmin CRUD, admin/instructor read
CREATE POLICY "Superadmin full access on sections"
  ON public.sections FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Admin read sections"
  ON public.sections FOR SELECT TO authenticated
  USING (
    public.is_admin() AND course_id IN (
      SELECT c.id FROM public.courses c
      JOIN public.admin_establishments ae ON ae.establishment_id = c.establishment_id
      WHERE ae.admin_id = auth.uid()
    )
  );

CREATE POLICY "Instructor read sections"
  ON public.sections FOR SELECT TO authenticated
  USING (
    public.is_instructor_or_above() AND course_id IN (
      SELECT p.course_id FROM public.profiles p WHERE p.id = auth.uid() AND p.course_id IS NOT NULL
    )
  );

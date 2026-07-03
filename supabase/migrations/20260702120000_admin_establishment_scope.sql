-- Admin scope narrowing.
--
-- Hasta ahora un admin veía TODO su establecimiento (una fila admin_establishments
-- por admin+establecimiento). Ahora una fila puede acotarse a una ASIGNATURA
-- (course) y/o SECCIÓN (section):
--   course_id/section_id NULL      = "Todas" (todo el establecimiento / todas las secciones)
--   course_id set, section_id NULL = solo esa asignatura (todas sus secciones)
--   section_id set                 = solo esa sección (elegir sección implica su asignatura)
--   sin fila para el establecimiento = admin "sin asignar" ahí = no ve nada
--
-- Backward-compatible: las filas existentes quedan con course_id/section_id NULL
-- = "Todas" = exactamente el comportamiento actual.

ALTER TABLE public.admin_establishments
  ADD COLUMN IF NOT EXISTS course_id  UUID REFERENCES public.courses(id)  ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE;

-- El UNIQUE(admin_id, establishment_id) impedía tener varias filas acotadas por
-- establecimiento. Se reemplaza por una unicidad que incluye course/section
-- (NULLs tratados como iguales vía COALESCE, para no permitir filas "Todas" duplicadas).
ALTER TABLE public.admin_establishments
  DROP CONSTRAINT IF EXISTS admin_establishments_admin_id_establishment_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS admin_establishments_scope_uniq
  ON public.admin_establishments (
    admin_id,
    establishment_id,
    COALESCE(course_id,  '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(section_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_admin_establishments_course  ON public.admin_establishments(course_id);
CREATE INDEX IF NOT EXISTS idx_admin_establishments_section ON public.admin_establishments(section_id);

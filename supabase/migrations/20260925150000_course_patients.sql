-- Pacientes habilitados por asignatura, para el programa de certificación.
--
-- Mismo patrón que establishment_patients (20260320011829), pero a nivel de
-- asignatura: el admin decide explícitamente qué pacientes forman parte del
-- programa.
--
-- Semántica: en /pacientes el alumno sigue viendo TODOS los pacientes
-- visibles por su establecimiento (más los habilitados acá aunque no
-- matcheen esa visibilidad) — los que NO están en esta tabla se muestran
-- grises con candado, sin ninguna acción posible; los que SÍ están se ven a
-- color con el flujo normal de agenda. Sin ninguna fila acá, todos quedan
-- grises. Solo aplica cuando courses.is_certification_program = true; el
-- resto de las asignaturas no se ve afectado (nunca consultan esta tabla).

CREATE TABLE public.course_patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  ai_patient_id UUID NOT NULL REFERENCES public.ai_patients(id) ON DELETE CASCADE,
  granted_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, ai_patient_id)
);

CREATE INDEX idx_course_patients_course  ON public.course_patients(course_id);
CREATE INDEX idx_course_patients_patient ON public.course_patients(ai_patient_id);

ALTER TABLE public.course_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on course_patients"
  ON public.course_patients FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Admin view course_patients in scope"
  ON public.course_patients FOR SELECT TO authenticated
  USING (
    public.is_admin() AND course_id IN (
      SELECT c.id FROM public.courses c
      JOIN public.admin_establishments ae ON ae.establishment_id = c.establishment_id
      WHERE ae.admin_id = auth.uid()
    )
  );

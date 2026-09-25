-- Programa de certificación asincrónica.
--
-- Un "programa de certificación" no es una jerarquía nueva: es una asignatura
-- (course) marcada con is_certification_program, igual que min_session_minutes
-- vive en courses porque la expectativa es pedagógica, no institucional. Todos
-- los estudiantes de esa asignatura comparten las mismas reglas (sin override
-- por alumno individual en esta iteración).
--
-- Todos los defaults reproducen EXACTAMENTE el comportamiento actual de la
-- plataforma, así que ninguna asignatura existente cambia de comportamiento:
--   - distraction_action/distraction_cut_threshold: hoy TODO el chat corta la
--     sesión en el 2do evento de distracción combinado (pegar o cambiar de
--     pestaña). default 'cut' + 2 reproduce eso exactamente.
--   - max_session_minutes/max_session_messages: NULL = sin aviso, misma
--     filosofía que min_session_minutes (nunca bloquea, solo recomienda).

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_certification_program boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_feedback_mode text NOT NULL DEFAULT 'docente',
  ADD COLUMN IF NOT EXISTS certification_block_paste boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_watch_tab_switch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_email_notifications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_min_hours_between_sessions integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS max_session_minutes integer,
  ADD COLUMN IF NOT EXISTS max_session_messages integer,
  ADD COLUMN IF NOT EXISTS distraction_action text NOT NULL DEFAULT 'cut',
  ADD COLUMN IF NOT EXISTS distraction_cut_threshold integer NOT NULL DEFAULT 2;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_certification_feedback_mode_check
    CHECK (certification_feedback_mode IN ('auto', 'docente')),
  ADD CONSTRAINT courses_certification_min_hours_check
    CHECK (certification_min_hours_between_sessions > 0),
  ADD CONSTRAINT courses_max_session_minutes_range
    CHECK (max_session_minutes IS NULL OR (max_session_minutes > 0 AND max_session_minutes <= 240)),
  ADD CONSTRAINT courses_max_session_messages_range
    CHECK (max_session_messages IS NULL OR (max_session_messages > 0 AND max_session_messages <= 200)),
  ADD CONSTRAINT courses_distraction_action_check
    CHECK (distraction_action IN ('cut', 'alert_only')),
  ADD CONSTRAINT courses_distraction_cut_threshold_check
    CHECK (distraction_cut_threshold >= 1);

COMMENT ON COLUMN public.courses.is_certification_program IS
  'Programa de certificación online asincrónico: pacientes agendados/bloqueados, mínimo de horas entre sesiones, y los toggles certification_*.';
COMMENT ON COLUMN public.courses.certification_feedback_mode IS
  '''docente'' (default, igual que hoy): el feedback de la IA queda pending hasta que un docente lo aprueba. ''auto'': se aprueba solo, sin pasar por revisión docente.';
COMMENT ON COLUMN public.courses.certification_block_paste IS
  'Además de contar el pegado de texto largo (paste_count), bloquea el evento (preventDefault) en vez de solo registrarlo.';
COMMENT ON COLUMN public.courses.certification_watch_tab_switch IS
  'Extiende la vigilancia de cambio de pestaña más allá de pacientes "avanzado" (hoy es la única condición que la activa).';
COMMENT ON COLUMN public.courses.certification_email_notifications IS
  'Envía recordatorio por correo antes de una sesión agendada y aviso cuando el feedback queda disponible.';
COMMENT ON COLUMN public.courses.certification_min_hours_between_sessions IS
  'Horas mínimas entre el fin de una sesión y el inicio de la siguiente, cruzado entre TODOS los pacientes del alumno (no por paciente). Default 72.';
COMMENT ON COLUMN public.courses.max_session_minutes IS
  'Minutos de sesión tras los que se muestra un aviso (no bloqueante) recomendando cerrarla. NULL = sin aviso.';
COMMENT ON COLUMN public.courses.max_session_messages IS
  'Cantidad de mensajes tras los que se muestra un aviso (no bloqueante) recomendando cerrar la sesión. NULL = sin aviso.';
COMMENT ON COLUMN public.courses.distraction_action IS
  '''cut'' (default, comportamiento actual de toda la plataforma): al llegar a distraction_cut_threshold eventos de distracción, la sesión se cierra. ''alert_only'': nunca cierra, solo avisa la primera vez y sigue contando.';
COMMENT ON COLUMN public.courses.distraction_cut_threshold IS
  'Cantidad de eventos de distracción (pegar + cambiar de pestaña, combinados) antes de cerrar la sesión cuando distraction_action = ''cut''. Default 2 = comportamiento actual.';

-- ============================================================
-- patient_schedules: un cupo agendado por paciente por estudiante.
-- ============================================================

CREATE TABLE public.patient_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_patient_id      UUID NOT NULL REFERENCES public.ai_patients(id) ON DELETE CASCADE,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (status IN ('pendiente', 'completada', 'cancelada')),
  conversation_id    UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  rescheduled_count  INTEGER NOT NULL DEFAULT 0,
  reminder_sent_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, ai_patient_id)
);

COMMENT ON TABLE public.patient_schedules IS
  'Agenda 1:1 de pacientes del programa de certificación: el alumno se autoagenda cada paciente; reprogramar actualiza la misma fila (no crea una nueva).';

CREATE INDEX idx_patient_schedules_student ON public.patient_schedules(student_id);
CREATE INDEX idx_patient_schedules_pending_reminder
  ON public.patient_schedules(scheduled_at)
  WHERE status = 'pendiente' AND reminder_sent_at IS NULL;

CREATE TRIGGER set_patient_schedules_updated_at
  BEFORE UPDATE ON public.patient_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patient_schedules ENABLE ROW LEVEL SECURITY;

-- Estudiante: lee y actualiza sus propias filas (la validación de negocio —
-- 72h, choques, fecha futura — vive en el route handler, no en RLS).
CREATE POLICY "Student manage own patient_schedules"
  ON public.patient_schedules FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Instructor: lee acotado a su establecimiento (mismo patrón que
-- 20260525120000_scope_feedback_rls_by_establishment.sql usa para
-- session_feedback). El acotado fino por sección/curso ya se resuelve en
-- aplicación (src/lib/section-scope.ts), esto es defensa en profundidad
-- contra acceso directo vía PostgREST.
CREATE POLICY "Instructors view establishment patient_schedules"
  ON public.patient_schedules FOR SELECT TO authenticated
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

-- Superadmin: acceso total.
CREATE POLICY "Superadmin full access on patient_schedules"
  ON public.patient_schedules FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

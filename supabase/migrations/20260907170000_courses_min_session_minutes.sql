-- Duración mínima esperada de una entrevista, por asignatura.
--
-- Va en courses y no en establishments porque la expectativa es pedagógica,
-- no institucional: UPC ya tiene "Psicopatología del Adulto" (entrevistas
-- largas) y "Práctica Profesional I" al mismo tiempo. Ponerlo a nivel de
-- establecimiento le impondría el mismo mínimo a las dos.
--
-- NULL = sin aviso, que es el estado correcto para todas las asignaturas que
-- ya existen. Un número N = avisar cuando el alumno finaliza antes de N
-- minutos. El aviso NUNCA bloquea: el alumno siempre puede finalizar igual.
-- Es una expectativa, no un candado.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS min_session_minutes INTEGER;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_min_session_minutes_range
  CHECK (min_session_minutes IS NULL OR (min_session_minutes > 0 AND min_session_minutes <= 180));

COMMENT ON COLUMN public.courses.min_session_minutes IS
  'Minutos de entrevista esperados en esta asignatura. NULL = sin aviso. El aviso al finalizar antes es informativo, nunca bloquea.';

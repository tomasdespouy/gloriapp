-- Ficha de continuidad: acuerdos/tareas por sesión, para que el paciente
-- los recuerde en la siguiente sesión (memoria cross-sesión más específica).
-- Aditiva, NOT NULL con default vacío → retrocompatible con filas existentes.

alter table public.session_summaries
  add column if not exists commitments text[] not null default '{}'::text[];

comment on column public.session_summaries.commitments is
  'Acuerdos o tareas concretas definidas en la sesión (continuidad cross-sesión). Poblado por /api/sessions/[conversationId]/summary.';

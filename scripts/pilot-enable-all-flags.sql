-- ============================================================
-- Script admin (NO migración): activa los 4 flags de UI
-- para un piloto específico. Correr manualmente con psql o
-- desde el SQL editor de Supabase.
--
-- Idempotente: el merge sobre JSONB preserva cualquier otro
-- flag que ya exista en ui_config.
-- ============================================================

-- PASO 1 — Listar pilotos activos para identificar el UUID correcto.
-- Ejecutar SOLO esta query primero, copiar el id del piloto que
-- quieres configurar y pegarlo en el PASO 2.
--
-- SELECT id, name, institution, status, scheduled_at, ended_at, ui_config
-- FROM pilots
-- WHERE status NOT IN ('cancelado', 'finalizado')
-- ORDER BY created_at DESC;

-- PASO 2 — Reemplazar PEGA_AQUI_EL_UUID por el UUID real del piloto
-- (sin los "<>", sólo el UUID entre comillas simples) y ejecutar.

UPDATE pilots
SET ui_config = COALESCE(ui_config, '{}'::jsonb) || jsonb_build_object(
  'hide_live_recording', true,
  'hide_microlearning', true,
  'skip_tutor_redirect', true,
  'skip_self_reflection', true
)
WHERE id = 'PEGA_AQUI_EL_UUID';

-- PASO 3 — Verificar.
SELECT id, name, ui_config
FROM pilots
WHERE id = 'PEGA_AQUI_EL_UUID';

-- ============================================================
-- Forzar cambio de contraseña en el primer ingreso.
--
-- Bandera por usuario: cuando un admin crea una cuenta (o resetea la
-- clave) con una contraseña temporal, se marca must_change_password=true.
-- El layout de la app intercepta a ese usuario y lo manda a /cambiar-clave
-- antes de dejarlo entrar. Al guardar su nueva clave, la bandera se apaga.
--
-- Default false: NO afecta a los usuarios existentes ni a los pilotos
-- anónimos (que entran con una clave de un solo uso y se enrolan por otro
-- flujo que nunca prende esta bandera).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'Si true, el usuario debe cambiar su contraseña temporal antes de usar la plataforma (gate en el layout → /cambiar-clave). Se prende al crear/resetear con clave temporal; se apaga al cambiarla.';

-- Anti-distracción: dejar registro de lo que hoy solo vive en el navegador.
--
-- El chat ya detecta dos cosas: pegar texto largo desde otra parte, y cambiar
-- de pestaña. Pero el conteo vivía en el estado de React y se perdía al cerrar
-- la sesión, así que la pregunta "¿esta alumna estuvo atenta?" no tenía
-- respuesta en ninguna parte.
--
-- Dos columnas y no una: el pegado se vigila para todos los estudiantes, el
-- cambio de pestaña SOLO con pacientes de nivel avanzado (decisión de producto:
-- en principiante e intermedio se admite consultar material). Sumarlas en un
-- solo contador mezclaría dos cosas que ni siquiera se miden en las mismas
-- sesiones, y un informe no podría distinguir "no pasó" de "no se vigilaba".

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS paste_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tab_switch_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.conversations.paste_count IS
  'Veces que el estudiante pegó texto largo desde fuera. Se vigila en todos los niveles.';
COMMENT ON COLUMN public.conversations.tab_switch_count IS
  'Veces que el estudiante salió de la pestaña. Solo se vigila con pacientes de nivel avanzado; 0 en el resto significa "no se midió", no "no ocurrió".';

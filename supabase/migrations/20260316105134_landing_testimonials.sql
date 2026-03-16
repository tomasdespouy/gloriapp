-- ============================================================
-- LANDING PAGE TESTIMONIALS
-- Admin-manageable testimonials for the marketing page
-- ============================================================

CREATE TABLE public.landing_testimonials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote       TEXT NOT NULL,
  name        TEXT NOT NULL,
  year        TEXT NOT NULL,
  career      TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.landing_testimonials ENABLE ROW LEVEL SECURITY;

-- Anyone can read active testimonials (public landing page)
CREATE POLICY "Anyone can view active testimonials"
  ON public.landing_testimonials FOR SELECT
  USING (is_active = TRUE);

-- Only admins can manage testimonials
CREATE POLICY "Admins manage testimonials"
  ON public.landing_testimonials FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

-- Seed with initial testimonials
INSERT INTO public.landing_testimonials (quote, name, year, career, sort_order) VALUES
  ('Antes de GloriA, mi única práctica era con compañeros haciendo role-play. Conversar con un paciente que realmente reacciona a lo que digo cambió mi forma de entender la terapia.', 'Valentina Rojas', '4to año', 'Psicología Clínica', 1),
  ('Me ayudó mucho a manejar silencios y pacientes resistentes. Con Carmen aprendí que presionar no funciona, y esa lección me la llevé a mi práctica profesional.', 'Sebastián Contreras', '5to año', 'Psicología Clínica', 2),
  ('Lo uso antes de cada evaluación práctica. Puedo repetir la sesión, probar distintos enfoques y ver cómo cambia la respuesta del paciente. Es como un simulador de vuelo para terapeutas.', 'Catalina Muñoz', '3er año', 'Psicología', 3);

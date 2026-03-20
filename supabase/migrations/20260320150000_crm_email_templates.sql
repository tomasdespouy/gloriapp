CREATE TABLE public.crm_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('presentacion', 'seguimiento', 'propuesta', 'demo', 'general')),
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access on crm_email_templates"
  ON public.crm_email_templates FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Seed default templates
INSERT INTO public.crm_email_templates (name, subject, body_html, category, is_default) VALUES
('Presentación inicial', 'GlorIA — Plataforma de formación clínica con IA', '<div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #4A55A2;">Estimado/a {{contact_name}},</h2><p>Mi nombre es [nombre] y me comunico desde GlorIA, una plataforma de formación clínica que utiliza pacientes simulados por inteligencia artificial para estudiantes de psicología.</p><p>Nos encantaría presentarle cómo GlorIA puede beneficiar al programa de {{program_name}} en {{institution}}.</p><p>¿Tendría disponibilidad para una breve demostración de 20 minutos?</p><p>Quedo atento/a,<br/>Equipo GlorIA</p></div>', 'presentacion', true),
('Seguimiento', 'Seguimiento — GlorIA para {{institution}}', '<div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #4A55A2;">Estimado/a {{contact_name}},</h2><p>Espero que se encuentre bien. Le escribo para dar seguimiento a nuestra conversación anterior sobre GlorIA.</p><p>¿Ha tenido oportunidad de evaluar nuestra propuesta? Estamos disponibles para resolver cualquier consulta.</p><p>Saludos cordiales,<br/>Equipo GlorIA</p></div>', 'seguimiento', true),
('Propuesta formal', 'Propuesta de implementación — GlorIA × {{institution}}', '<div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #4A55A2;">Estimado/a {{contact_name}},</h2><p>Adjunto encontrará la propuesta formal de implementación de GlorIA para el programa de {{program_name}} en {{institution}}.</p><p>La propuesta contempla acceso para {{estimated_students}} estudiantes aproximadamente.</p><p>Quedo a su disposición para coordinar los próximos pasos.</p><p>Cordialmente,<br/>Equipo GlorIA</p></div>', 'propuesta', true),
('Invitación a demo', 'Demostración de GlorIA — {{institution}}', '<div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #4A55A2;">Estimado/a {{contact_name}},</h2><p>Le confirmamos su demostración de GlorIA programada para [fecha y hora].</p><p>Durante la sesión le mostraremos:<br/>- Cómo funcionan los pacientes simulados por IA<br/>- El sistema de evaluación por competencias<br/>- El panel de supervisión docente<br/>- Métricas y reportes para su institución</p><p>El enlace de la reunión es: [enlace]</p><p>¡Nos vemos pronto!<br/>Equipo GlorIA</p></div>', 'demo', true);

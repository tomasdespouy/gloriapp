-- Add category field to technical_reports for easier navigation
ALTER TABLE technical_reports
ADD COLUMN category TEXT DEFAULT 'general'
CHECK (category IN ('técnico', 'pacientes', 'validación', 'paper', 'reporte', 'general'));

-- Index for filtering by category
CREATE INDEX idx_technical_reports_category ON technical_reports(category);

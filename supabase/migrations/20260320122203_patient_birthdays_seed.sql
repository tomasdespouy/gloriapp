-- Populate birthday for all patients that don't have one yet.
-- Uses a deterministic hash of the patient name for month/day,
-- and the patient's age to derive the birth year.

UPDATE public.ai_patients
SET birthday = make_date(
  extract(year FROM CURRENT_DATE)::int - COALESCE(age, 30),
  1 + abs(hashtext(name)) % 12,
  1 + abs(hashtext(name || 'day')) % 28
)
WHERE birthday IS NULL AND age IS NOT NULL;

-- Change country from TEXT to TEXT[] to support multiple countries
ALTER TABLE public.ai_patients
  ALTER COLUMN country DROP DEFAULT,
  ALTER COLUMN country TYPE TEXT[] USING CASE WHEN country IS NULL THEN '{Chile}' ELSE ARRAY[country] END,
  ALTER COLUMN country SET DEFAULT '{Chile}';

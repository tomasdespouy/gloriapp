-- Flexible answer storage for survey responses
-- The legacy schema (nps_score / positives / improvements / comments)
-- assumed every survey was a 4-question NPS form. The new UGM
-- experience survey has 10 questions of mixed types (radio, likert
-- grid, number, multiple textareas) which do not fit that schema.
--
-- This migration adds an `answers` JSONB column that holds the entire
-- response keyed by question id. Existing rows keep their NPS columns;
-- new rows can use either schema (or both, for backward compatibility).

ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS answers JSONB;

COMMENT ON COLUMN public.survey_responses.answers IS
  'Flexible JSONB storage for arbitrary survey schemas. Keys are
   question ids ("q1", "q2", ...); values are strings, numbers, or
   nested objects for likert grids ({"item1": 4, "item2": 5}).';

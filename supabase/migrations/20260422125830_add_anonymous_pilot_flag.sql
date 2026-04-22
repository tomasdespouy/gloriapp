-- Anonymous pilot flag.
--
-- Some universities require fully anonymous pilots: participants must
-- not provide their real name or email. The system generates a synthetic
-- email (anon-{nanoid}@piloto.glor-ia.com) and a secure password after
-- each student signs a simplified consent form. No personal data is
-- collected, and the admin dashboard only shows aggregated counts.
--
-- Schema impact is additive only:
--   - pilots.is_anonymous              → the pilot runs in anonymous mode
--   - pilot_participants.is_anonymous  → the row was auto-generated
--   - pilot_consents.anonymous_consent → the consent was signed anonymously
--
-- Existing NOT NULL columns (full_name, email, signed_name in
-- pilot_consents) stay as-is; the anonymous endpoint fills them with
-- a placeholder ("(anónimo)") plus the synthetic email so audit trails
-- remain consistent and no schema migration is needed to reverse.

ALTER TABLE public.pilots
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pilot_participants
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pilot_consents
  ADD COLUMN IF NOT EXISTS anonymous_consent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pilots.is_anonymous IS
  'When true, enrollment uses /piloto/{slug}/consent-anon and the system auto-generates synthetic credentials. No personal data is collected.';

COMMENT ON COLUMN public.pilot_participants.is_anonymous IS
  'True if this participant row was created through the anonymous enrollment flow.';

COMMENT ON COLUMN public.pilot_consents.anonymous_consent IS
  'True if the consent was signed through the anonymous flow (personal data fields contain placeholders).';

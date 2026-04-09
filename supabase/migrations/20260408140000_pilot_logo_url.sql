-- Pilot logo override
-- Adds a per-pilot logo URL that takes precedence over the establishment's
-- logo_url. Used so the same establishment can run multiple pilots with
-- different visual identities (e.g. UGM may run a "Piloto Q2 con UBO" and
-- a "Piloto Q3 con UCSC" — each can carry its own institutional branding).

ALTER TABLE public.pilots
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.pilots.logo_url IS
  'Optional public URL of the pilot/institution logo. When set, takes
   precedence over establishments.logo_url for this pilot. Displayed in
   the public consent page header, in the in-platform sidebar for any
   user enrolled in this pilot, and in the credentials email header.';

-- Add credentials_sent_at to profiles to support deferred credential delivery.
-- When NULL, the user has been created but hasn't received their login email.
-- Set to now() by /api/admin/users/create (if send_credentials=true) and by
-- /api/admin/users/[id]/reset-password on successful send.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credentials_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.credentials_sent_at IS
  'Timestamp when the user was emailed their login credentials. NULL means not yet sent.';

-- Add last_seen_at to profiles for real-time presence tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Index for quick presence queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen_at) WHERE last_seen_at IS NOT NULL;

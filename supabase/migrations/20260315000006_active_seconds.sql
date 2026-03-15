-- Track real active time (only when tab is visible)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS active_seconds INTEGER DEFAULT 0;

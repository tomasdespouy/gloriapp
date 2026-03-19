-- Track total platform time per user per day (1 row per user per day)
CREATE TABLE platform_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

-- Index for dashboard queries
CREATE INDEX idx_platform_activity_date ON platform_activity(activity_date);
CREATE INDEX idx_platform_activity_user ON platform_activity(user_id, activity_date);

-- RLS
ALTER TABLE platform_activity ENABLE ROW LEVEL SECURITY;

-- Users can read their own activity
CREATE POLICY "Users read own activity"
  ON platform_activity FOR SELECT
  USING (auth.uid() = user_id);

-- Users can upsert their own activity (heartbeat)
CREATE POLICY "Users upsert own activity"
  ON platform_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own activity"
  ON platform_activity FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins read all
CREATE POLICY "Admins read all activity"
  ON platform_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Atomic upsert function for heartbeat
CREATE OR REPLACE FUNCTION increment_platform_activity(
  p_user_id UUID,
  p_date DATE,
  p_seconds INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO platform_activity (user_id, activity_date, active_seconds, updated_at)
  VALUES (p_user_id, p_date, p_seconds, now())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    active_seconds = platform_activity.active_seconds + p_seconds,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

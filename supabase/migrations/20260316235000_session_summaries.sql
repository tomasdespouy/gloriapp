-- Session summaries for multi-session memory
-- After each completed session, an AI-generated summary is stored here.
-- When a new session starts, ALL summaries for that student+patient are loaded
-- into the system prompt as long-term memory.

CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ai_patient_id UUID NOT NULL REFERENCES ai_patients(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  summary TEXT NOT NULL,
  key_revelations TEXT[] DEFAULT '{}',
  therapeutic_progress TEXT,
  final_clinical_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id)
);

-- Index for fast lookup: all summaries for a student+patient pair
CREATE INDEX IF NOT EXISTS idx_session_summaries_student_patient
  ON session_summaries(student_id, ai_patient_id, session_number);

-- RLS
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own summaries"
  ON session_summaries FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Service role full access on summaries"
  ON session_summaries FOR ALL
  USING (true)
  WITH CHECK (true);

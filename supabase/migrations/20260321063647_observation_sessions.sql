-- ============================================================================
-- Observation sessions: live observation with walkie-talkie recording
-- ============================================================================

-- Observation session type
CREATE TABLE public.observation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Observación en vivo',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  semantic_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Individual audio segments within an observation
CREATE TABLE public.observation_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.observation_sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('observer', 'patient')),
  audio_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  segment_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_observation_sessions_student ON public.observation_sessions(student_id);
CREATE INDEX idx_observation_segments_session ON public.observation_segments(session_id);

-- RLS
ALTER TABLE public.observation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own observation sessions"
  ON public.observation_sessions FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students manage own observation segments"
  ON public.observation_segments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.observation_sessions os
      WHERE os.id = observation_segments.session_id
      AND os.student_id = auth.uid()
    )
  );

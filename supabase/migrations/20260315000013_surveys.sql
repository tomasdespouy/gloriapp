-- ============================================================
-- SURVEYS: NPS satisfaction surveys
-- ============================================================

CREATE TABLE public.surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  scope_type  TEXT NOT NULL CHECK (scope_type IN ('global', 'country', 'establishment', 'course', 'section')),
  scope_id    TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage surveys"
  ON public.surveys FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

CREATE POLICY "All users view active surveys"
  ON public.surveys FOR SELECT TO authenticated
  USING (is_active = TRUE AND NOW() BETWEEN starts_at AND ends_at);

-- Survey responses
CREATE TABLE public.survey_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id   UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nps_score   INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  positives   TEXT,
  improvements TEXT,
  comments    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(survey_id, user_id)
);

CREATE INDEX idx_survey_responses_survey ON public.survey_responses(survey_id);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own responses"
  ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (public.is_admin_or_superadmin());

-- ============================================
-- GAMIFICATION & LMS TABLES
-- ============================================

-- Student progress tracking (1 row per student)
CREATE TABLE public.student_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  level             INTEGER NOT NULL DEFAULT 1,
  level_name        TEXT NOT NULL DEFAULT 'Observador',
  total_xp          INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_session_date DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session competency scores (1 per completed session)
CREATE TABLE public.session_competencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empathy             NUMERIC(3,1) NOT NULL DEFAULT 0,
  active_listening    NUMERIC(3,1) NOT NULL DEFAULT 0,
  open_questions      NUMERIC(3,1) NOT NULL DEFAULT 0,
  reformulation       NUMERIC(3,1) NOT NULL DEFAULT 0,
  confrontation       NUMERIC(3,1) NOT NULL DEFAULT 0,
  silence_management  NUMERIC(3,1) NOT NULL DEFAULT 0,
  rapport             NUMERIC(3,1) NOT NULL DEFAULT 0,
  overall_score       NUMERIC(3,1) NOT NULL DEFAULT 0,
  ai_commentary       TEXT,
  strengths           TEXT[] DEFAULT '{}',
  areas_to_improve    TEXT[] DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_competencies_student ON public.session_competencies(student_id);

-- Achievement definitions
CREATE TABLE public.achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'star',
  category    TEXT NOT NULL DEFAULT 'general',
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student earned achievements
CREATE TABLE public.student_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, achievement_id)
);

CREATE INDEX idx_student_achievements_student ON public.student_achievements(student_id);

-- Message annotations for replay
CREATE TABLE public.message_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('positive', 'suggestion', 'technique', 'warning')),
  annotation_text TEXT NOT NULL,
  competency      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_annotations_message ON public.message_annotations(message_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_annotations ENABLE ROW LEVEL SECURITY;

-- student_progress: students manage own
CREATE POLICY "Students view own progress"
  ON public.student_progress FOR SELECT
  USING (auth.uid() = student_id);
CREATE POLICY "Students insert own progress"
  ON public.student_progress FOR INSERT
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students update own progress"
  ON public.student_progress FOR UPDATE
  USING (auth.uid() = student_id);

-- session_competencies: students view own
CREATE POLICY "Students view own competencies"
  ON public.session_competencies FOR SELECT
  USING (auth.uid() = student_id);
CREATE POLICY "Students insert own competencies"
  ON public.session_competencies FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- achievements: all authenticated can view
CREATE POLICY "Authenticated view achievements"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (true);

-- student_achievements: students manage own
CREATE POLICY "Students view own achievements"
  ON public.student_achievements FOR SELECT
  USING (auth.uid() = student_id);
CREATE POLICY "Students insert own achievements"
  ON public.student_achievements FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- message_annotations: accessible through conversation ownership
CREATE POLICY "Students view annotations on own messages"
  ON public.message_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_annotations.message_id
      AND c.student_id = auth.uid()
    )
  );

-- ============================================
-- AUTO-CREATE student_progress ON PROFILE CREATION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_student_progress()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.student_progress (student_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_progress
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_student_progress();

-- ============================================
-- SEED ACHIEVEMENTS
-- ============================================
INSERT INTO public.achievements (key, name, description, icon, category, xp_reward) VALUES
  ('first_session',       'Primera Sesion',         'Completaste tu primera sesion terapeutica',                        'heart',          'milestone',    50),
  ('five_sessions',       'Practicante Dedicado',   'Completaste 5 sesiones',                                          'star',           'milestone',    100),
  ('ten_sessions',        'Veterano',               'Completaste 10 sesiones',                                         'trophy',         'milestone',    200),
  ('empathy_master',      'Maestro de la Empatia',  'Obtuviste 9+ en empatia en una sesion',                           'sparkles',       'skill',        75),
  ('listening_master',    'Oido Clinico',           'Obtuviste 9+ en escucha activa en una sesion',                    'ear',            'skill',        75),
  ('rapport_master',      'Alianza Solida',         'Obtuviste 9+ en rapport en una sesion',                           'handshake',      'skill',        75),
  ('streak_3',            'Constancia',             '3 dias consecutivos practicando',                                 'flame',          'streak',       50),
  ('streak_7',            'Semana Completa',         '7 dias consecutivos practicando',                                'fire',           'streak',       150),
  ('all_beginners',       'Base Completa',          'Completaste al menos una sesion con cada paciente principiante',  'check-circle',   'exploration',  150),
  ('first_reflection',    'Practica Reflexiva',     'Completaste tu primera reflexion post-sesion',                    'book-open',      'milestone',    25),
  ('high_performer',      'Alto Rendimiento',       'Obtuviste 8+ de puntaje general en una sesion',                  'zap',            'skill',        100),
  ('perfect_session',     'Sesion Perfecta',        'Obtuviste 10 en alguna competencia',                             'award',          'skill',        150);

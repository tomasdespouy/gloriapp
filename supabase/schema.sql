-- ============================================================
-- GloriA — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE: ai_patients
-- ============================================================
CREATE TABLE public.ai_patients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  age                 INTEGER,
  occupation          TEXT,
  quote               TEXT NOT NULL,
  presenting_problem  TEXT NOT NULL,
  backstory           TEXT NOT NULL,
  personality_traits  JSONB NOT NULL DEFAULT '{}',
  system_prompt       TEXT NOT NULL,
  difficulty_level    TEXT NOT NULL DEFAULT 'beginner'
                        CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  tags                TEXT[] DEFAULT '{}',
  skills_practiced    TEXT[] DEFAULT '{}',
  total_sessions      INTEGER DEFAULT 5,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: conversations
-- ============================================================
CREATE TABLE public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_patient_id   UUID NOT NULL REFERENCES public.ai_patients(id) ON DELETE CASCADE,
  session_number  INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  student_notes   TEXT,
  student_emotions TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: messages
-- ============================================================
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);

-- ============================================================
-- TABLE: session_feedback
-- ============================================================
CREATE TABLE public.session_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discomfort_moment   TEXT,
  would_redo          TEXT,
  clinical_note       TEXT,
  ai_feedback         JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_student ON public.session_feedback(student_id);

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_ai_patients_updated_at
  BEFORE UPDATE ON public.ai_patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_feedback_updated_at
  BEFORE UPDATE ON public.session_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_patients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles: users see their own
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id);

-- AI Patients: all authenticated users can view active ones
CREATE POLICY "View active patients"
  ON public.ai_patients FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Conversations: students see their own
CREATE POLICY "Students view own conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = student_id);

CREATE POLICY "Students create own conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = student_id);

CREATE POLICY "Students update own conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = student_id);

-- Messages: students see messages in their conversations
CREATE POLICY "Students view own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.student_id = (SELECT auth.uid())
  ));

CREATE POLICY "Students insert own messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.student_id = (SELECT auth.uid())
  ));

-- Session feedback: students see/create their own
CREATE POLICY "Students view own feedback"
  ON public.session_feedback FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = student_id);

CREATE POLICY "Students create own feedback"
  ON public.session_feedback FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = student_id);

CREATE POLICY "Students update own feedback"
  ON public.session_feedback FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = student_id);

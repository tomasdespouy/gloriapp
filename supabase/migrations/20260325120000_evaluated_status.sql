-- ============================================================
-- ADD 'evaluated' STATUS TO FEEDBACK FLOW
-- Closes the loop: student acknowledges teacher feedback
-- Flow: pending → approved → evaluated
-- ============================================================

-- Drop the old constraint and recreate with 'evaluated'
ALTER TABLE public.session_competencies
  DROP CONSTRAINT IF EXISTS session_competencies_feedback_status_check;

ALTER TABLE public.session_competencies
  ADD CONSTRAINT session_competencies_feedback_status_check
    CHECK (feedback_status IN ('pending', 'approved', 'evaluated'));

-- Track when the student acknowledged the feedback
ALTER TABLE public.session_competencies
  ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

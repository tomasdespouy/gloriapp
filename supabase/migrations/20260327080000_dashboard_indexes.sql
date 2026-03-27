-- Indexes to reduce Disk IO on dashboard queries
-- These compound indexes eliminate full table scans when filtering
-- conversations by student_id with date ranges or status checks.

-- Dashboard: conversations filtered by student + date range (used 3x per dashboard load)
CREATE INDEX IF NOT EXISTS idx_conversations_student_started
  ON conversations(student_id, started_at DESC);

-- Live metrics + dashboard: conversations filtered by status + student
CREATE INDEX IF NOT EXISTS idx_conversations_status_student
  ON conversations(status, student_id);

-- Dashboard: session_competencies filtered by student + feedback_status
CREATE INDEX IF NOT EXISTS idx_session_competencies_student_feedback
  ON session_competencies(student_id, feedback_status);

-- Cron cleanup: active conversations older than 2 hours
CREATE INDEX IF NOT EXISTS idx_conversations_active_updated
  ON conversations(updated_at)
  WHERE status = 'active';

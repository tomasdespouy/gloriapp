-- Student personal notes per session (private, editable)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS student_notes_v2 TEXT DEFAULT '';

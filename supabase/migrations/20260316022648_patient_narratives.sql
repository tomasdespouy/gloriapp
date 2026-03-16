-- Cumulative narrative summaries per student-patient pair.
-- Updated after each completed session; used as compact memory in future sessions.

create table if not exists patient_narratives (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  ai_patient_id uuid not null references ai_patients(id) on delete cascade,
  narrative text not null default '',
  key_themes text[] not null default '{}',
  sessions_included int not null default 0,
  last_conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, ai_patient_id)
);

-- RLS: students see only their own narratives
alter table patient_narratives enable row level security;

create policy "Students read own narratives"
  on patient_narratives for select
  using (auth.uid() = student_id);

-- Service role (admin client) handles inserts/updates from the API
create policy "Service role manages narratives"
  on patient_narratives for all
  using (true)
  with check (true);

-- Index for fast lookup during loadMemory
create index idx_patient_narratives_lookup
  on patient_narratives(student_id, ai_patient_id);

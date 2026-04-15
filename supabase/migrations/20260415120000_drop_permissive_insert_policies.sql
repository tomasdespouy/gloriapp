-- ============================================================
-- Drop permissive RLS policies that granted authenticated users
-- unrestricted INSERT (and in one case ALL) access to tables
-- that must be written only by server-side code using the
-- service_role key (which bypasses RLS by default in Supabase).
--
-- The policies being dropped have USING(true) / WITH CHECK(true)
-- without `TO service_role`, so in practice they apply to every
-- role including `authenticated` — defeating the row-level
-- security of the tables they live on.
--
-- Verified before this migration: all production writes to these
-- tables come from createAdminClient() (service_role):
--   session_summaries  → api/sessions/*/summary, api/sessions/*/complete
--   clinical_state_log → api/chat/route.ts
--   system_metrics     → lib/logger.ts
--
-- Remaining policies (not touched by this migration):
--   session_summaries : "Students can view own summaries" (SELECT)
--   clinical_state_log: "Students view own clinical state" (SELECT)
--                       "Instructors view all clinical state" (SELECT)
--   system_metrics    : "Admins view metrics" (SELECT)
--
-- Rollback (if needed):
--   CREATE POLICY "Service role full access on summaries"
--     ON session_summaries FOR ALL USING (true) WITH CHECK (true);
--   CREATE POLICY "System insert clinical state"
--     ON public.clinical_state_log FOR INSERT TO authenticated
--     WITH CHECK (true);
--   CREATE POLICY "System insert metrics"
--     ON public.system_metrics FOR INSERT TO authenticated
--     WITH CHECK (true);
-- ============================================================

DROP POLICY IF EXISTS "Service role full access on summaries" ON public.session_summaries;
DROP POLICY IF EXISTS "System insert clinical state"         ON public.clinical_state_log;
DROP POLICY IF EXISTS "System insert metrics"                ON public.system_metrics;

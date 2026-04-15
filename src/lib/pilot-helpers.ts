/**
 * Shared helpers for reasoning about whether a pilot is "live" — i.e.
 * flags from `pilots.ui_config` should still affect the student's
 * experience. Used as a defensive second layer in dashboard/review/
 * tutor pages on top of the redirect gate in (app)/layout.tsx.
 */

export type PilotActivityFields = {
  status?: string | null;
  scheduled_at?: string | null;
  ended_at?: string | null;
};

/** A pilot is "active" if it is neither cancelled/finalised nor past
    its end date. Pilots not yet scheduled don't count as active for
    flag application — if the pilot hasn't started, its flags shouldn't
    take effect either. */
export function isPilotActive(pilot: PilotActivityFields | null | undefined): boolean {
  if (!pilot) return false;
  if (pilot.status === "cancelado" || pilot.status === "finalizado") return false;
  const now = Date.now();
  if (pilot.ended_at) {
    const endsAt = new Date(pilot.ended_at).getTime();
    if (Number.isFinite(endsAt) && endsAt <= now) return false;
  }
  if (pilot.scheduled_at) {
    const startsAt = new Date(pilot.scheduled_at).getTime();
    if (Number.isFinite(startsAt) && startsAt > now) return false;
  }
  return true;
}

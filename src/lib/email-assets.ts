/**
 * Canonical asset URLs for transactional emails.
 *
 * Resolved at request time so we avoid hardcoding Supabase bucket paths
 * that break when files move. Uses the same logo the in-app sidebar
 * renders, served from /public/branding via the app's own domain.
 */

const DEFAULT_APP_URL = "https://app.glor-ia.com";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_APP_URL
  );
}

export function getGloriaLogoUrl(): string {
  return `${getAppUrl()}/branding/gloria-side-logo.png`;
}

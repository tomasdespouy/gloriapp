/**
 * Canonical asset URLs for transactional emails.
 *
 * Resolved at request time so we avoid hardcoding Supabase bucket paths
 * que se rompen si el archivo se mueve. Usa el mismo logo del sidebar,
 * servido desde /public/branding por el dominio canonico (src/lib/app-url).
 */

import { getAppUrl } from "./app-url";

export function getGloriaLogoUrl(): string {
  return `${getAppUrl()}/branding/gloria-side-logo.png`;
}

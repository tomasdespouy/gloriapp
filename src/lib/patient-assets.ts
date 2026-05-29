// `NEXT_PUBLIC_PATIENT_MEDIA_BASE_URL` lets local dev read patient media
// (PNGs, MP4s, the Gloria avatar) from prod's Supabase Storage even when
// the rest of the app is talking to staging. In prod the var is unset and
// the regular SUPABASE_URL is used.
const STORAGE_BASE = `${process.env.NEXT_PUBLIC_PATIENT_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients`;

export function getPatientAssetUrl(filename: string): string {
  return `${STORAGE_BASE}/${filename}`;
}

export function getPatientImageUrl(slug: string): string {
  return `${STORAGE_BASE}/${slug}.png`;
}

export function getPatientVideoUrl(slug: string): string {
  return `${STORAGE_BASE}/${slug}.mp4`;
}

export function getPatientImageFallback(slug: string): string {
  return `/patients/${slug}.png`;
}

export function getPatientVideoFallback(slug: string): string {
  return `/patients/${slug}.mp4`;
}

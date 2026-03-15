const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients`;

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

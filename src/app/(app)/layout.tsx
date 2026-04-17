import { Suspense } from "react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import ContentWrapper from "@/components/ContentWrapper";
import TopHeader from "@/components/TopHeader";
import NavigationProgress from "@/components/NavigationProgress";
import WelcomeVideoModal from "@/components/WelcomeVideoModal";
import SurveyModal from "@/components/SurveyModal";
import PlatformActivityTracker from "@/components/PlatformActivityTracker";
import GloriaAssistant from "@/components/GloriaAssistant";
import { Toaster } from "sonner";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_MODULE_KEYS } from "@/lib/modules";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getUserProfile();

  const role = profile?.role || "student";
  const realRole = profile?.realRole || role;
  const fullName = profile?.fullName || "Usuario";
  const email = profile?.email || "";
  const avatarUrl = profile?.avatarUrl || null;
  const isTrulySuperadmin = realRole === "superadmin";

  // Fetch establishment logo + active modules.
  // Sidebar logo cascade: pilot.logo_url → establishment.logo_url → UGM fallback
  let establishmentLogoUrl: string | null = null;
  let pilotLogoUrl: string | null = null;
  let activeModules: string[] | null = null; // null = all modules enabled
  let pilotUiConfig: Record<string, boolean> = {};

  const admin = createAdminClient();

  // Server-side source of truth for the welcome video. localStorage is
  // still used as a fallback (API down, race conditions), but this flag
  // wins: if the profile says they've seen it, we never show it again
  // — even across browsers, incognito, or shared machines.
  let welcomeVideoSeen = false;
  let a11yPrefs: { fontSize?: string; contrast?: string } = {};
  if (profile?.id) {
    const { data: prof } = await admin
      .from("profiles")
      .select("welcome_video_seen_at, a11y_prefs")
      .eq("id", profile.id)
      .single();
    welcomeVideoSeen = !!prof?.welcome_video_seen_at;
    a11yPrefs = (prof?.a11y_prefs as { fontSize?: string; contrast?: string }) || {};
  }

  // ─── Pilot access window enforcement + logo capture ───────────────────
  // If the user is a pilot participant and the pilot has scheduled_at /
  // ended_at set, block access outside that window. Superadmins bypass.
  // We also pick up pilots.logo_url here so the sidebar can show the
  // pilot's branding without an extra round trip.
  if (profile?.id && !isTrulySuperadmin) {
    const { data: participation } = await admin
      .from("pilot_participants")
      .select("pilot_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (participation?.pilot_id) {
      const { data: pilot } = await admin
        .from("pilots")
        .select("scheduled_at, ended_at, status, logo_url, ui_config")
        .eq("id", participation.pilot_id)
        .single();

      if (pilot) {
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        const startsAt = pilot.scheduled_at ? new Date(pilot.scheduled_at).getTime() : null;
        const endsAt = pilot.ended_at ? new Date(pilot.ended_at).getTime() : null;

        if (pilot.status === "cancelado") {
          redirect("/piloto-cerrado?reason=cancelado");
        } else if (startsAt && now < startsAt) {
          redirect("/piloto-cerrado?reason=not_yet");
        } else if ((endsAt && now > endsAt) || pilot.status === "finalizado") {
          redirect("/piloto-cerrado?reason=ended");
        }

        pilotLogoUrl = pilot.logo_url || null;
        pilotUiConfig = (pilot.ui_config || {}) as Record<string, boolean>;
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  if (profile?.establishmentId) {
    const [{ data: est }, { data: disabledModules }] = await Promise.all([
      admin.from("establishments").select("logo_url").eq("id", profile.establishmentId).single(),
      admin.from("establishment_modules").select("module_key").eq("establishment_id", profile.establishmentId).eq("is_active", false),
    ]);
    establishmentLogoUrl = est?.logo_url || null;
    const disabledKeys = new Set((disabledModules || []).map((m: { module_key: string }) => m.module_key));
    activeModules = ALL_MODULE_KEYS.filter((k) => !disabledKeys.has(k));
  }

  // Pilot-level overrides: must run even when the participant has no
  // establishment attached. If activeModules is still null (no establishment),
  // seed it with ALL_MODULE_KEYS so the filter can subtract from a full set.
  const hasPilotHides = pilotUiConfig.hide_live_recording || pilotUiConfig.hide_microlearning;
  if (hasPilotHides) {
    if (activeModules === null) activeModules = [...ALL_MODULE_KEYS];
    if (pilotUiConfig.hide_live_recording) {
      activeModules = activeModules.filter((m) => m !== "grabacion");
    }
    if (pilotUiConfig.hide_microlearning) {
      activeModules = activeModules.filter((m) => m !== "aprendizaje");
    }
  }

  // Pilot logo overrides establishment logo when present.
  const sidebarLogoUrl = pilotLogoUrl || establishmentLogoUrl;

  // Fetch all establishments for superadmin impersonation dropdown
  let allEstablishments: { id: string; name: string }[] = [];
  if (isTrulySuperadmin) {
    const { data } = await admin
      .from("establishments")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    allEstablishments = data || [];
  }

  return (
    <SidebarProvider>
      {/* Use dynamic viewport height so mobile browsers don't collapse the
          app when the URL bar / keyboard slides in and out. Falls back
          gracefully on older browsers via Tailwind's @supports emission. */}
      <div className="flex h-dvh overflow-hidden">
        <Suspense><NavigationProgress /></Suspense>
        <Sidebar role={role} establishmentLogoUrl={sidebarLogoUrl} activeModules={activeModules} />
        <ContentWrapper>
          <TopHeader
            userName={fullName}
            userEmail={email}
            userRole={role}
            realRole={realRole}
            avatarUrl={avatarUrl}
            isImpersonating={profile?.isImpersonating || false}
            impersonationLabel={profile?.impersonationLabel}
            establishments={isTrulySuperadmin ? allEstablishments : undefined}
            a11yPrefs={a11yPrefs as { fontSize?: "m" | "l" | "xl"; contrast?: "default" | "high" }}
          />
          <main id="main-content" className="flex-1 bg-bg-main min-h-0 overflow-auto dashboard-pattern">
            {children}
          </main>
        </ContentWrapper>
        <GloriaAssistant userName={fullName} userRole={role} />
        <WelcomeVideoModal userId={profile?.id} userRole={role} alreadySeen={welcomeVideoSeen} />
        <SurveyModal welcomeVideoSeen={welcomeVideoSeen} />
        <PlatformActivityTracker />
        <Toaster position="top-right" richColors closeButton />
      </div>
    </SidebarProvider>
  );
}

import { Suspense } from "react";
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

  // Fetch establishment logo + active modules
  let establishmentLogoUrl: string | null = null;
  let activeModules: string[] | null = null; // null = all modules enabled

  const admin = createAdminClient();

  if (profile?.establishmentId) {
    const [{ data: est }, { data: disabledModules }] = await Promise.all([
      admin.from("establishments").select("logo_url").eq("id", profile.establishmentId).single(),
      admin.from("establishment_modules").select("module_key").eq("establishment_id", profile.establishmentId).eq("is_active", false),
    ]);
    establishmentLogoUrl = est?.logo_url || null;
    const disabledKeys = new Set((disabledModules || []).map((m: { module_key: string }) => m.module_key));
    activeModules = ALL_MODULE_KEYS.filter((k) => !disabledKeys.has(k));
  }

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
      <div className="flex h-screen overflow-hidden">
        <Suspense><NavigationProgress /></Suspense>
        <Sidebar role={role} establishmentLogoUrl={establishmentLogoUrl} activeModules={activeModules} />
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
          />
          <main id="main-content" className="flex-1 bg-bg-main min-h-0 overflow-auto dashboard-pattern">
            {children}
          </main>
        </ContentWrapper>
        {(role === "student" || role === "instructor") && (
          <GloriaAssistant userName={fullName} />
        )}
        <WelcomeVideoModal />
        <SurveyModal />
        <PlatformActivityTracker />
        <Toaster position="top-right" richColors closeButton />
      </div>
    </SidebarProvider>
  );
}

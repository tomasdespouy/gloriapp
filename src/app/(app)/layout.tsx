import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import WelcomeVideoModal from "@/components/WelcomeVideoModal";
import SurveyModal from "@/components/SurveyModal";
import PlatformActivityTracker from "@/components/PlatformActivityTracker";
import { Toaster } from "sonner";
import { getUserProfile } from "@/lib/supabase/user-profile";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getUserProfile();

  const role = profile?.role || "student";
  const fullName = profile?.fullName || "Usuario";
  const email = profile?.email || "";
  const avatarUrl = profile?.avatarUrl || null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <div className="ml-0 md:ml-[260px] flex-1 flex flex-col min-h-0">
        <TopHeader userName={fullName} userEmail={email} userRole={role} avatarUrl={avatarUrl} />
        <main id="main-content" className="flex-1 bg-bg-main min-h-0 overflow-auto dashboard-pattern">
          {children}
        </main>
      </div>
      <WelcomeVideoModal />
      <SurveyModal />
      <PlatformActivityTracker />
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

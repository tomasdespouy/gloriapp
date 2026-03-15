import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import WelcomeVideoModal from "@/components/WelcomeVideoModal";
import SurveyModal from "@/components/SurveyModal";
import { ToastProvider } from "@/components/Toast";
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

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <div className="ml-0 lg:ml-[260px] flex-1 flex flex-col">
          <TopHeader userName={fullName} userEmail={email} userRole={role} />
          <main className="flex-1 bg-bg-main">
            {children}
          </main>
        </div>
        <WelcomeVideoModal />
        <SurveyModal />
      </div>
    </ToastProvider>
  );
}

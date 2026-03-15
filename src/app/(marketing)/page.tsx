import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import PatientShowcase from "@/components/landing/PatientShowcase";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import StatsSection from "@/components/landing/StatsSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (role === "admin" || role === "superadmin") {
      redirect("/admin/dashboard");
    } else if (role === "instructor") {
      redirect("/docente/dashboard");
    } else {
      redirect("/dashboard");
    }
  }

  // Fetch active patients for showcase
  const admin = createAdminClient();
  const { data: patients } = await admin
    .from("ai_patients")
    .select("name, age, country_origin, country_residence")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (
    <div className="bg-white">
      <LandingNavbar />
      <HeroSection />
      <HowItWorks />
      <PatientShowcase patients={patients || []} />
      <FeaturesSection />
      <TestimonialsSection />
      <StatsSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}

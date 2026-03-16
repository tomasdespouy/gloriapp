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
import InstitutionsSection from "@/components/landing/InstitutionsSection";
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

  // Fetch active patients and institutions for showcase
  const admin = createAdminClient();
  const [{ data: patients }, { data: institutions }, { data: testimonials }] =
    await Promise.all([
      admin
        .from("ai_patients")
        .select("name, age, country_origin, country_residence")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      admin
        .from("establishments")
        .select("name, slug, logo_url, country")
        .eq("is_active", true)
        .order("name"),
      admin
        .from("landing_testimonials")
        .select("quote, name, year, career")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  return (
    <div className="bg-white">
      <LandingNavbar />
      <HeroSection />
      <StatsSection />
      <HowItWorks />
      <PatientShowcase patients={patients || []} />
      <FeaturesSection />
      <TestimonialsSection testimonials={testimonials || []} />
      <InstitutionsSection institutions={institutions || []} />
      <CTASection />
      <LandingFooter />
    </div>
  );
}

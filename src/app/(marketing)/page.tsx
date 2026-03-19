import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import PatientShowcase from "@/components/landing/PatientShowcase";
import FeaturesSection from "@/components/landing/FeaturesSection";
import UniversitiesSection from "@/components/landing/UniversitiesSection";
import ImpactSection from "@/components/landing/ImpactSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import StatsSection from "@/components/landing/StatsSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import PressSection from "@/components/landing/PressSection";
import FAQSection from "@/components/landing/FAQSection";
import ContactSection from "@/components/landing/ContactSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default async function LandingPage() {
  // Cache landing data for 5 minutes (stats don't change often)
  const getLandingData = unstable_cache(
    async () => {
      const db = createAdminClient();
      const [
        { data: patientsRaw },
        { count: patientCount },
        { count: sessionCount },
        { data: countriesData },
      ] = await Promise.all([
        db.from("ai_patients").select("name, age, country_origin, country_residence").eq("is_active", true),
        db.from("ai_patients").select("id", { count: "exact", head: true }).eq("is_active", true),
        db.from("conversations").select("id", { count: "exact", head: true }),
        db.from("ai_patients").select("country").eq("is_active", true),
      ]);
      return { patientsRaw, patientCount, sessionCount, countriesData };
    },
    ["landing-data"],
    { revalidate: 300 }
  );

  const supabase = await createClient();
  const [{ data: { user } }, landingData] = await Promise.all([
    supabase.auth.getUser(),
    getLandingData(),
  ]);

  const { patientsRaw, patientCount, sessionCount, countriesData } = landingData;

  // Redirect logged-in users to their dashboard
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

  const patients = (patientsRaw || []).sort(() => Math.random() - 0.5);
  const uniqueCountries = new Set<string>();
  (countriesData || []).forEach((p) => ((p.country as string[]) || []).forEach((c) => uniqueCountries.add(c)));

  return (
    <div id="main-content" className="bg-white">
      <LandingNavbar />
      <HeroSection />
      <StatsSection
        patients={patientCount || 34}
        sessions={sessionCount || 0}
        countries={uniqueCountries.size || 7}
      />
      <HowItWorks />
      <PatientShowcase patients={patients || []} />
      <FeaturesSection />
      <ComparisonSection />
      <ImpactSection />
      <TestimonialsSection />
      <UniversitiesSection />
      <PressSection />
      <FAQSection />
      <ContactSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}

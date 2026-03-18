import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
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

export default async function LocaleLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale) || locale === defaultLocale) {
    notFound();
  }

  const dict = await getDictionary(locale as Locale);

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
  const { data: patientsRaw } = await admin
    .from("ai_patients")
    .select("name, age, country_origin, country_residence")
    .eq("is_active", true);

  const patients = (patientsRaw || []).sort(() => Math.random() - 0.5);

  const { count: patientCount } = await admin
    .from("ai_patients")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: sessionCount } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true });

  const { data: countriesData } = await admin
    .from("ai_patients")
    .select("country")
    .eq("is_active", true);
  const uniqueCountries = new Set<string>();
  (countriesData || []).forEach((p) =>
    ((p.country as string[]) || []).forEach((c) => uniqueCountries.add(c))
  );

  return (
    <div id="main-content" className="bg-white">
      <LandingNavbar dict={dict} locale={locale} />
      <HeroSection dict={dict} locale={locale} />
      <StatsSection
        patients={patientCount || 34}
        sessions={sessionCount || 0}
        countries={uniqueCountries.size || 7}
        dict={dict}
      />
      <HowItWorks dict={dict} />
      <PatientShowcase patients={patients || []} dict={dict} />
      <FeaturesSection dict={dict} />
      <ComparisonSection dict={dict} />
      <ImpactSection dict={dict} />
      <TestimonialsSection dict={dict} />
      <UniversitiesSection dict={dict} />
      <PressSection dict={dict} />
      <FAQSection dict={dict} />
      <ContactSection dict={dict} locale={locale} />
      <CTASection dict={dict} locale={locale} />
      <LandingFooter dict={dict} locale={locale} />
    </div>
  );
}

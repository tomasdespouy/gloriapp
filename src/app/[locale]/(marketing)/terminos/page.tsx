import { notFound } from "next/navigation";
import Link from "next/link";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export default async function LocaleTerminosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale) || locale === defaultLocale) {
    notFound();
  }

  const dict = await getDictionary(locale as Locale);

  return (
    <>
      <LandingNavbar dict={dict} locale={locale} />
      <main className="bg-[#FAFAFA] min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{dict["footer.terms"] || "footer.terms"}</h1>
          <p className="text-sm text-gray-500 mb-10">
            {locale === "en"
              ? "This document is available in Spanish only. The Spanish version is the legally binding text."
              : "Este documento está disponível apenas em espanhol. A versão em espanhol é o texto juridicamente vinculante."}
          </p>

          <div className="prose prose-sm prose-gray max-w-none text-gray-600">
            <p>
              {locale === "en"
                ? "Please refer to the Spanish version for the full terms and conditions."
                : "Consulte a versão em espanhol para os termos e condições completos."}
            </p>
            <p className="mt-4">
              <Link href="/terminos" className="text-sidebar hover:underline">
                {locale === "en" ? "View Terms and Conditions (Spanish)" : "Ver Termos e Condições (Espanhol)"}
              </Link>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link href={`/${locale}`} className="text-sm text-sidebar hover:underline">
              {locale === "en" ? "Back to home" : "Voltar ao início"}
            </Link>
          </div>
        </div>
      </main>
      <LandingFooter dict={dict} locale={locale} />
    </>
  );
}

import { notFound } from "next/navigation";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { DictionaryProvider } from "@/i18n/DictionaryContext";
import SetHtmlLang from "@/i18n/SetHtmlLang";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale — only non-default locales ("en", "pt") should reach this layout
  if (!locales.includes(locale as Locale) || locale === defaultLocale) {
    notFound();
  }

  const dictionary = await getDictionary(locale as Locale);

  return (
    <DictionaryProvider dictionary={dictionary}>
      <SetHtmlLang locale={locale} />
      {children}
    </DictionaryProvider>
  );
}

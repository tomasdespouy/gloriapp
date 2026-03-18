"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2, Building2 } from "lucide-react";
import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

const COUNTRIES = [
  "Chile", "Argentina", "Colombia", "Perú", "México",
  "Ecuador", "Bolivia", "Uruguay", "Paraguay", "Venezuela",
  "República Dominicana", "Costa Rica", "Panamá", "Guatemala",
  "Honduras", "El Salvador", "Nicaragua", "Cuba", "España", "Otro",
];

interface ContactSectionProps {
  dict: Record<string, string>;
  locale?: string;
}

export default function ContactSection({ dict, locale = "es" }: ContactSectionProps) {
  const t = (key: string) => dict[key] || key;
  const [form, setForm] = useState({
    institution: "",
    country: "",
    city: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    program_name: "Psicología",
    estimated_students: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const prefix = locale === "es" ? "" : `/${locale}`;

  const update = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.institution.trim() || !form.contact_name.trim() || !form.contact_email.trim() || !form.country) {
      setError(t("contact.requiredError"));
      return;
    }
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || t("contact.genericError"));
      }
    } catch {
      setError(t("contact.connectionError"));
    }
    setSending(false);
  };

  if (sent) {
    return (
      <section id="contacto" className="bg-[#FAFAFA] py-16 lg:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <ScrollReveal>
            <div className="bg-white rounded-2xl border border-gray-200 p-10">
              <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t("contact.successTitle")}</h3>
              <p className="text-sm text-gray-600">
                {t("contact.successMessage")}
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  return (
    <section id="contacto" className="bg-[#FAFAFA] py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-xl bg-sidebar/10 flex items-center justify-center mx-auto mb-4">
              <Building2 size={24} className="text-sidebar" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              {t("contact.title")}
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              {t("contact.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-5">
            {/* Institution info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.institution")}</label>
                <input
                  type="text"
                  value={form.institution}
                  onChange={(e) => update("institution", e.target.value)}
                  placeholder={t("contact.institutionPlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.program")}</label>
                <input
                  type="text"
                  value={form.program_name}
                  onChange={(e) => update("program_name", e.target.value)}
                  placeholder={t("contact.programPlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.country")}</label>
                <select
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30 bg-white"
                >
                  <option value="">{t("contact.countryPlaceholder")}</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.city")}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder={t("contact.cityPlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.contactName")}</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => update("contact_name", e.target.value)}
                  placeholder={t("contact.contactNamePlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.email")}</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => update("contact_email", e.target.value)}
                  placeholder={t("contact.emailPlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.phone")}</label>
                <input
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e) => update("contact_phone", e.target.value)}
                  placeholder={t("contact.phonePlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.students")}</label>
                <input
                  type="number"
                  value={form.estimated_students}
                  onChange={(e) => update("estimated_students", e.target.value)}
                  placeholder={t("contact.studentsPlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t("contact.message")}</label>
              <textarea
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                placeholder={t("contact.messagePlaceholder")}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/30 focus:border-sidebar/30 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-sidebar text-white py-3 rounded-xl text-sm font-semibold hover:bg-sidebar-hover transition-colors disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("contact.sending")}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {t("contact.submit")}
                </>
              )}
            </button>

            <p className="text-[10px] text-gray-400 text-center">
              {t("contact.privacy")}{" "}
              <Link href={`${prefix}/privacidad`} className="underline hover:text-sidebar">{t("contact.privacyLink")}</Link>.
            </p>
          </form>
        </ScrollReveal>
      </div>
    </section>
  );
}

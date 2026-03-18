"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface LandingNavbarProps {
  dict: Record<string, string>;
  locale?: string;
}

export default function LandingNavbar({ dict, locale = "es" }: LandingNavbarProps) {
  const t = (key: string) => dict[key] || key;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const prefix = locale === "es" ? "" : `/${locale}`;

  const navLinks = [
    { label: t("nav.howItWorks"), href: "#como-funciona" },
    { label: t("nav.patients"), href: "#pacientes" },
    { label: t("nav.testimonials"), href: "#testimonios" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSmoothScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
    setOpen(false);
    const id = href.replace("#", "");
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReduced ? "instant" : "smooth" });
  };

  // Build locale switcher links based on current path
  const localeLinks = [
    { code: "es", label: "ES", href: "/" },
    { code: "en", label: "EN", href: "/en" },
    { code: "pt", label: "PT", href: "/pt" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200"
          : "bg-white border-b border-gray-100"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={prefix || "/"} className="flex items-center">
            <Image src="/branding/gloria-logo.png" alt="GlorIA" width={120} height={32} className="h-8 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleSmoothScroll(e, link.href)}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </a>
            ))}

            {/* Language switcher */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {localeLinks.map((l, i) => (
                <span key={l.code} className="flex items-center">
                  {i > 0 && <span className="mx-1">|</span>}
                  <Link
                    href={l.href}
                    className={`hover:text-gray-900 transition-colors ${
                      locale === l.code ? "text-gray-900 font-bold" : ""
                    }`}
                  >
                    {l.label}
                  </Link>
                </span>
              ))}
            </div>

            <Link
              href="/login"
              className="text-sm font-medium text-[#4A55A2] border border-[#4A55A2] px-4 py-2 rounded-lg hover:bg-[#4A55A2]/5 transition-colors"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-[#4A55A2] px-4 py-2 rounded-lg hover:bg-[#3D4890] transition-colors"
            >
              {t("nav.signup")}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="p-2 text-gray-600 hover:text-gray-900">
                  {open ? <X size={24} /> : <Menu size={24} />}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-white">
                <SheetTitle className="sr-only">{t("nav.mobileMenuTitle")}</SheetTitle>
                <div className="flex flex-col gap-6 mt-8">
                  {navLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleSmoothScroll(e, link.href)}
                      className="text-base text-gray-700 hover:text-gray-900"
                    >
                      {link.label}
                    </a>
                  ))}

                  {/* Mobile language switcher */}
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    {localeLinks.map((l, i) => (
                      <span key={l.code} className="flex items-center">
                        {i > 0 && <span className="mx-1">|</span>}
                        <Link
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className={`hover:text-gray-900 transition-colors ${
                            locale === l.code ? "text-gray-900 font-bold" : ""
                          }`}
                        >
                          {l.label}
                        </Link>
                      </span>
                    ))}
                  </div>

                  <hr className="border-gray-200" />
                  <Link
                    href="/login"
                    className="text-base font-medium text-[#4A55A2]"
                    onClick={() => setOpen(false)}
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    href="/signup"
                    className="text-center font-medium text-white bg-[#4A55A2] px-4 py-3 rounded-lg hover:bg-[#3D4890] transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    {t("nav.signup")}
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}

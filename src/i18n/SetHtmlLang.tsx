"use client";

import { useEffect } from "react";

export default function SetHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = "es";
    };
  }, [locale]);

  return null;
}

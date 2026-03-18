import type { Locale } from "./config";

const dictionaries: Record<string, () => Promise<Record<string, string>>> = {
  es: () => import("./dictionaries/es.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  pt: () => import("./dictionaries/pt.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return (dictionaries[locale] || dictionaries.es)();
}

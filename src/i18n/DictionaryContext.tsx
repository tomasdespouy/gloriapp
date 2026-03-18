"use client";

import { createContext, useContext } from "react";

type Dictionary = Record<string, string>;

const DictionaryContext = createContext<Dictionary>({});

export function DictionaryProvider({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
}) {
  return (
    <DictionaryContext.Provider value={dictionary}>
      {children}
    </DictionaryContext.Provider>
  );
}

export function useTranslation() {
  const dict = useContext(DictionaryContext);
  return (key: string) => dict[key] || key;
}

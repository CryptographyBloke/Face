import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
export type Language = "zh" | "en";
export type Theme = "light" | "dark" | "system";
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* In-memory state remains usable. */
  }
}
const Context = createContext<{
  lang: Language;
  zh: boolean;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (zh: string, en: string) => string;
} | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("wallet-face-language");
      return saved === "zh" || saved === "en"
        ? saved
        : navigator.language.startsWith("zh")
          ? "zh"
          : "en";
    } catch {
      return "en";
    }
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readLocal<string>("wallet-face:theme:v1", "system");
    return ["dark", "light", "system"].includes(saved)
      ? (saved as Theme)
      : "system";
  });
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("wallet-face-language", lang);
    } catch {
      /* Session preference. */
    }
  }, [lang]);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (query?.matches ? "dark" : "light") : theme;
    };
    apply();
    saveLocal("wallet-face:theme:v1", theme);
    query?.addEventListener?.("change", apply);
    return () => query?.removeEventListener?.("change", apply);
  }, [theme]);
  const zh = lang === "zh";
  return (
    <Context.Provider
      value={{
        lang,
        zh,
        setLang,
        theme,
        setTheme,
        t: (cn, en) => (zh ? cn : en),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider is required");
  return value;
}

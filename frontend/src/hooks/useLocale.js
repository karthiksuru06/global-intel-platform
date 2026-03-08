import { create } from "zustand";

// Supported locales
const SUPPORTED_LOCALES = ["en", "fr", "es", "ar", "zh"];

// English fallback (loaded inline to avoid async on first render)
import enMessages from "../locales/en.json";

const localeCache = new Map();
localeCache.set("en", enMessages);

// Detect browser language
function detectLocale() {
  const stored = localStorage.getItem("gip-locale");
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const browserLang = navigator.language?.split("-")[0] || "en";
  return SUPPORTED_LOCALES.includes(browserLang) ? browserLang : "en";
}

const useLocale = create((set, get) => ({
  locale: detectLocale(),
  messages: enMessages, // Start with English
  supportedLocales: SUPPORTED_LOCALES,
  loading: false,

  setLocale: async (locale) => {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    localStorage.setItem("gip-locale", locale);

    // Apply RTL for Arabic
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";

    // Check cache
    if (localeCache.has(locale)) {
      set({ locale, messages: localeCache.get(locale) });
      return;
    }

    // Lazy-load locale bundle
    set({ loading: true });
    try {
      const mod = await import(`../locales/${locale}.json`);
      const messages = mod.default;
      localeCache.set(locale, messages);
      set({ locale, messages, loading: false });
    } catch (err) {
      console.error(`Failed to load locale ${locale}:`, err);
      set({ locale: "en", messages: enMessages, loading: false });
    }
  },

  // Translation function with fallback to English
  t: (key) => {
    const { messages } = get();
    return messages[key] || enMessages[key] || key;
  },
}));

// Initialize locale on load
const initialLocale = detectLocale();
if (initialLocale !== "en") {
  useLocale.getState().setLocale(initialLocale);
}
if (initialLocale === "ar") {
  document.documentElement.dir = "rtl";
}

export default useLocale;

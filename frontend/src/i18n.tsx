import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "th" | "en";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
};

const dictionaries: Record<Language, Record<string, string>> = {
  en: {
    "nav.search": "Search products, shops...",
    "nav.searchMobile": "Search...",
    "nav.lightMode": "Light mode",
    "nav.darkMode": "Dark mode",
    "nav.login": "Login",
    "nav.signUp": "Sign Up",
    "nav.logout": "Logout",
    "nav.myProfile": "My Profile",
    "nav.myOrders": "My Orders",
    "nav.wishlist": "Wishlist",
    "nav.seller": "Seller",
    "nav.admin": "Admin",
    "nav.adminPanel": "Admin Panel",
    "seller.dashboard": "Dashboard",
    "seller.products": "Products",
    "seller.orders": "Orders",
    "seller.analytics": "Analytics",
    "seller.reviews": "Reviews",
    "seller.settings": "Settings",
  },
  th: {
    "nav.search": "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 \u0e2b\u0e23\u0e37\u0e2d\u0e23\u0e49\u0e32\u0e19\u0e04\u0e49\u0e32...",
    "nav.searchMobile": "\u0e04\u0e49\u0e19\u0e2b\u0e32...",
    "nav.lightMode": "\u0e42\u0e2b\u0e21\u0e14\u0e01\u0e25\u0e32\u0e07\u0e27\u0e31\u0e19",
    "nav.darkMode": "\u0e42\u0e2b\u0e21\u0e14\u0e01\u0e25\u0e32\u0e07\u0e04\u0e37\u0e19",
    "nav.login": "\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a",
    "nav.signUp": "\u0e2a\u0e21\u0e31\u0e04\u0e23",
    "nav.logout": "\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a",
    "nav.myProfile": "\u0e42\u0e1b\u0e23\u0e44\u0e1f\u0e25\u0e4c",
    "nav.myOrders": "\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e02\u0e2d\u0e07\u0e09\u0e31\u0e19",
    "nav.wishlist": "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e0a\u0e2d\u0e1a",
    "nav.seller": "\u0e1c\u0e39\u0e49\u0e02\u0e32\u0e22",
    "nav.admin": "\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19",
    "nav.adminPanel": "\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19",
    "seller.dashboard": "\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21",
    "seller.products": "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
    "seller.orders": "\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c",
    "seller.analytics": "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c",
    "seller.reviews": "\u0e23\u0e35\u0e27\u0e34\u0e27",
    "seller.settings": "\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32",
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const initialLanguage = (): Language => {
  const stored = localStorage.getItem("shopx_language");
  if (stored === "th" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("th") ? "th" : "en";
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    localStorage.setItem("shopx_language", next);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(language === "th" ? "en" : "th"),
    t: (key, fallback) => dictionaries[language][key] || dictionaries.en[key] || fallback || key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

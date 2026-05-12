import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Settings = Record<string, string>;

const SettingsContext = createContext<{ settings: Settings; get: (k: string, fallback?: string) => string; flag: (k: string) => boolean }>({
  settings: {},
  get: (_k, f = "") => f,
  flag: () => true,
});

export const useAppSettings = () => useContext(SettingsContext);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings = {} } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("key, value");
      const map: Settings = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 30_000,
  });

  const get = (k: string, fallback = "") => settings[k] ?? fallback;
  const flag = (k: string) => {
    if (k === "reels" || k === "stories") return true;
    const v = settings[`flag_${k}`];
    return v === undefined ? true : v === "true";
  };

  // Apply theme tokens + custom CSS live
  useEffect(() => {
    const root = document.documentElement;
    const tokenMap: Record<string, string> = {
      theme_primary: "--primary",
      theme_background: "--background",
      theme_accent: "--accent",
      theme_foreground: "--foreground",
      theme_secondary: "--secondary",
      theme_muted: "--muted",
      theme_border: "--border",
      theme_card: "--card",
      theme_destructive: "--destructive",
      theme_ring: "--ring",
    };
    for (const [k, cssVar] of Object.entries(tokenMap)) {
      const v = settings[k];
      if (v) root.style.setProperty(cssVar, v);
    }

    // Custom CSS injection
    let styleEl = document.getElementById("admin-custom-css") as HTMLStyleElement | null;
    const css = settings["custom_css"] || "";
    if (css) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "admin-custom-css";
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = css;
    } else if (styleEl) {
      styleEl.innerHTML = "";
    }

    // App name in document title
    const appName = settings["app_name"];
    if (appName) document.title = appName;
  }, [settings]);

  return <SettingsContext.Provider value={{ settings, get, flag }}>{children}</SettingsContext.Provider>;
}

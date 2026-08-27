"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "admin_tenant_theme_mode";

interface ThemeModeContextValue {
  mode: ThemeMode;
  /** Bascule le mode. Passer l'événement de clic anime la transition en
   *  cercle qui se propage depuis le bouton cliqué (View Transitions API,
   *  avec repli silencieux — changement instantané — sur les navigateurs qui
   *  ne la supportent pas). */
  toggleMode: (origin?: { x: number; y: number }) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "light",
  toggleMode: () => {},
});

function readStoredMode(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyModeToDocument(mode: ThemeMode) {
  document.documentElement.setAttribute("data-color-scheme", mode);
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  // Valeur initiale toujours "light" côté serveur (SSR) pour éviter un
  // mismatch d'hydratation — le mode réel (localStorage ou préférence
  // système) est appliqué juste après le montage.
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = readStoredMode();
    const initial = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(initial);
    applyModeToDocument(initial);
  }, []);

  const applyToggle = useCallback(() => {
    flushSync(() => {
      setMode((prev) => {
        const next: ThemeMode = prev === "light" ? "dark" : "light";
        applyModeToDocument(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
        return next;
      });
    });
  }, []);

  const toggleMode = useCallback((origin?: { x: number; y: number }) => {
    const supportsViewTransition =
      typeof document !== "undefined" &&
      typeof (document as any).startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsViewTransition) {
      applyToggle();
      return;
    }

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = (document as any).startViewTransition(() => applyToggle());
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => { /* transition annulée (navigation rapide, etc.) — sans conséquence */ });
  }, [applyToggle]);

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}

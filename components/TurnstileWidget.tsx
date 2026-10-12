"use client";

import { useEffect, useRef } from "react";

// ⚠️ DUPLIQUÉ INTENTIONNELLEMENT dans Admin_tenant/components/TurnstileWidget.tsx (projets indépendants).

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error("turnstile script")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Widget Cloudflare Turnstile. Ne rend rien si NEXT_PUBLIC_TURNSTILE_SITE_KEY est absent (dev local).
 * `resetKey` : incrémenter après un échec de connexion (un jeton n'est utilisable qu'une fois).
 */
export function TurnstileWidget({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const cbRef = useRef(onToken);
  cbRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !boxRef.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
          size: "flexible",
          callback: (t: string) => cbRef.current(t),
          "expired-callback": () => cbRef.current(null),
          "error-callback": () => cbRef.current(null),
        });
      })
      .catch(() => cbRef.current(null));
    return () => {
      cancelled = true;
      if (idRef.current) window.turnstile?.remove(idRef.current);
      idRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && idRef.current) {
      cbRef.current(null);
      window.turnstile?.reset(idRef.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={boxRef} style={{ marginBottom: 20, minHeight: 65 }} />;
}

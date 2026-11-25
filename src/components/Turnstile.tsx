"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare's bot check for the sign-in form. Usually invisible; the token goes to Supabase with the email. */
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string | undefined) => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widget: string | undefined;
    let cancelled = false;
    const draw = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget = window.turnstile.render(box.current, {
        sitekey: siteKey,
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(undefined),
        "error-callback": () => onToken(undefined),
      });
    };
    if (window.turnstile) draw();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", draw);
    }
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [siteKey, onToken]);

  return <div ref={box} />;
}

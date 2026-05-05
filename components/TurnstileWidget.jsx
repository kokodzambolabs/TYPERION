'use client';

// Cloudflare Turnstile - prosta, niewidoczna captcha.
// Renderujemy widget WEWNĄTRZ <form> - Turnstile sam wstawi hidden input
// "cf-turnstile-response" z tokenem, więc Server Action weźmie go z FormData
// bez naszej pomocy.
//
// Dodatkowo wystawiamy callback `onToken(token | null)`, żeby rodzic mógł
// dezaktywować przycisk submit dopóki nie mamy tokena. Token wygasa po
// 5 minutach (Cloudflare go wtedy odświeża albo wymaga interakcji).
//
// Jeśli NEXT_PUBLIC_TURNSTILE_SITE_KEY jest pusty - pokazujemy placeholder
// i NIE blokujemy submitu (developerska wersja bez kluczy).

import Script from 'next/script';
import { useEffect, useId, useRef, useState } from 'react';

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function TurnstileWidget({ onToken }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerId = useId();
  const widgetRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const [zaladowane, setZaladowane] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !zaladowane || !window.turnstile) return;

    const id = window.turnstile.render(`#${CSS.escape(containerId)}`, {
      sitekey: siteKey,
      callback: (token) => onTokenRef.current?.(token),
      'expired-callback': () => onTokenRef.current?.(null),
      'error-callback': () => onTokenRef.current?.(null),
    });
    widgetRef.current = id;

    return () => {
      try {
        if (widgetRef.current && window.turnstile) {
          window.turnstile.remove(widgetRef.current);
        }
      } catch {
        // Widget mógł zostać już zdjęty - ignorujemy.
      }
      widgetRef.current = null;
    };
  }, [siteKey, zaladowane, containerId]);

  if (!siteKey) {
    return (
      <div className="rounded-md border border-yellow-500/40 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-200">
        ⚠️ Turnstile nieaktywny (brak NEXT_PUBLIC_TURNSTILE_SITE_KEY w env).
      </div>
    );
  }

  return (
    <>
      <Script
        src={SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => setZaladowane(true)}
        onReady={() => setZaladowane(true)}
      />
      <div id={containerId} />
    </>
  );
}

'use client';

// Mały przycisk kopiujący kod do schowka. Po sukcesie pokazuje "Skopiowano!"
// na 2 sekundy, potem wraca do "Skopiuj".

import { useState } from 'react';

export default function KopiujKod({ kod }) {
  const [skopiowano, setSkopiowano] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(kod);
          setSkopiowano(true);
          setTimeout(() => setSkopiowano(false), 2000);
        } catch {
          // Clipboard API może być niedostępny (np. http bez TLS) - fallback.
          window.prompt('Skopiuj kod:', kod);
        }
      }}
      className="rounded-md border border-emerald-500/40 bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
    >
      {skopiowano ? '✅ Skopiowano!' : 'Skopiuj'}
    </button>
  );
}

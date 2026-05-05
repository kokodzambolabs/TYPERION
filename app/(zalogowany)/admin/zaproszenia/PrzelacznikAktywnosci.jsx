'use client';

// Przełącznik Aktywuj/Dezaktywuj kod. Wywołuje odpowiednią Server Action
// w zależności od bieżącego stanu.

import { useTransition } from 'react';

export default function PrzelacznikAktywnosci({
  aktywny,
  akcjaAktywuj,
  akcjaDezaktywuj,
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const akcja = aktywny ? akcjaDezaktywuj : akcjaAktywuj;
          const wynik = await akcja();
          if (wynik?.error) alert(wynik.error);
        });
      }}
      className={`rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
        aktywny
          ? 'border-yellow-500/40 bg-yellow-950/30 text-yellow-100 hover:bg-yellow-900/40'
          : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100 hover:bg-emerald-900/40'
      }`}
    >
      {pending ? '…' : aktywny ? 'Dezaktywuj' : 'Aktywuj'}
    </button>
  );
}

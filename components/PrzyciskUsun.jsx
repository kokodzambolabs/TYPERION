'use client';

// Przycisk usuwania z confirm() i wyświetleniem błędu z Server Action.
// Akcja musi być Server Action (najczęściej z .bind(null, id)), zwracająca
// { ok: true } lub { error: 'opis' }.

import { useTransition } from 'react';

export default function PrzyciskUsun({
  akcja,
  etykieta = 'Na pewno usunąć?',
  dzieci = 'Usuń',
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(etykieta)) return;
        start(async () => {
          const result = await akcja();
          if (result?.error) alert(result.error);
        });
      }}
      className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-sm text-red-100 transition hover:bg-red-900/40 disabled:opacity-50"
    >
      {pending ? 'Usuwam…' : dzieci}
    </button>
  );
}

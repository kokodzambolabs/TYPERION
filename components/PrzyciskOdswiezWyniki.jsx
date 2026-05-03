'use client';

// Przycisk "Odśwież wyniki teraz" w /admin/mecze. Wywołuje Server Action
// recznieAktualizujWyniki - tę samą logikę co cron, tylko z sesją admina.
// Komunikat z odpowiedzi pokazujemy alertem (proste i wystarczające
// dla pojedynczego adminskiego przycisku).

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recznieAktualizujWyniki } from '@/app/akcje/api';

export default function PrzyciskOdswiezWyniki() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const onClick = () => {
    start(async () => {
      const res = await recznieAktualizujWyniki();
      if (res?.error) {
        alert(`Błąd odświeżania: ${res.error}`);
      } else if (res?.ok) {
        alert(res.ok);
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
    >
      {pending ? 'Odświeżam…' : '🔄 Odśwież wyniki teraz'}
    </button>
  );
}

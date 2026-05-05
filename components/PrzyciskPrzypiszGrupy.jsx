'use client';

// Przycisk "Przypisz drużyny do grup MŚ" na /admin/druzyny. Wywołuje
// aktualizujGrupyDruzyn() - czyta matches.group_name dla MŚ i ustawia
// teams.group_in_tournament. Wynik (liczba zmienionych drużyn) pokazujemy
// alertem - to jednorazowa akcja po imporcie meczów.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { aktualizujGrupyDruzyn } from '@/app/akcje/druzyny';

export default function PrzyciskPrzypiszGrupy() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const onClick = () => {
    start(async () => {
      const res = await aktualizujGrupyDruzyn();
      if (res?.error) {
        alert(`Błąd: ${res.error}`);
      } else {
        alert(`Przypisano ${res.updated} drużyn do grup.`);
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
      {pending ? 'Przypisuję…' : '🏆 Przypisz drużyny do grup MŚ'}
    </button>
  );
}

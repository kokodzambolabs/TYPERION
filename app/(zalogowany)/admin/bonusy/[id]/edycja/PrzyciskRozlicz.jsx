'use client';

// Przycisk "Rozlicz automatycznie" dla typów ważonych. Wywołuje server
// action rozliczAutomatycznie - punkty lecą z bonus_question_options.punkty
// dla opcji z is_correct=true. Odpowiedzi "Inny" (dropdown_other) zostają
// adminowi do ręcznego wpisania pod /rozlicz.

import { useTransition } from 'react';

export default function PrzyciskRozlicz({ akcjaRozlicz }) {
  const [pending, start] = useTransition();

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4">
      <p className="mb-3 text-sm text-amber-100">
        Po oznaczeniu poprawnej opcji rozlicz wszystkie odpowiedzi userów
        automatycznie. Punkty bierzemy z opcji oznaczonej jako poprawna.
        Odpowiedzi „Inny” w dropdown_other zostaną pominięte — wpiszesz im
        punkty ręcznie pod „Rozlicz”.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              'Rozliczyć wszystkie odpowiedzi automatycznie? Punkty zostaną przeliczone wg punktów z poprawnej opcji.',
            )
          )
            return;
          start(async () => {
            const res = await akcjaRozlicz();
            if (res?.error) alert(res.error);
            else if (res?.ok) alert(res.ok);
          });
        }}
        className="rounded-md border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
      >
        {pending ? 'Rozliczam…' : 'Rozlicz automatycznie'}
      </button>
    </div>
  );
}

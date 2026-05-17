'use client';

// Przycisk "Wygeneruj odpowiedzi botów na bonusy". Fire-and-forget -
// Server Action zleca zadania per (bot × pytanie ważone) do endpointa
// /api/generuj-bonus-pojedynczy, wraca natychmiast z liczbą zleconych.
// Wyniki widać w /admin/boty-ai/logi po 2-5 minutach.

import { useTransition, useState } from 'react';
import { wygenerujOdpowiedziBonusoweAI } from '@/app/akcje/ai-boty';

export default function PrzyciskGenerujBonusy() {
  const [pending, start] = useTransition();
  const [komunikat, setKomunikat] = useState(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              'Wygenerować odpowiedzi WSZYSTKICH botów na pytania bonusowe?\n\nKażdy bot dostanie po jednej odpowiedzi na każde nierozliczone pytanie ważone (które jeszcze nie ma jego odpowiedzi). To kosztuje API.',
            )
          )
            return;
          setKomunikat(null);
          start(async () => {
            const res = await wygenerujOdpowiedziBonusoweAI();
            setKomunikat(res);
          });
        }}
        className="rounded-md border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20 disabled:opacity-50"
      >
        {pending ? 'Zlecam…' : '🎯 Wygeneruj odpowiedzi botów na bonusy'}
      </button>

      {komunikat?.error && (
        <p className="mt-2 text-xs text-rose-300">{komunikat.error}</p>
      )}
      {komunikat?.ok && (
        <p className="mt-2 text-xs text-emerald-300">
          {komunikat.info || `Zlecono ${komunikat.zlecone} zadań.`}
        </p>
      )}
    </div>
  );
}

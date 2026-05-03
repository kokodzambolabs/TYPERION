'use client';

// Strona ręcznego rozliczania pytania typu text/number:
// - input "Poprawna odpowiedź" (referencja, zapisywana w correct_answer)
// - lista odpowiedzi userów: nick, ich odpowiedź, input punktów + przycisk "max"
// - przycisk "Zapisz wszystkie punkty"
// - przycisk "Oznacz jako rozliczone"

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';

export default function FormularzRozliczania({
  pytanie,
  odpowiedzi,
  akcjaZapiszPunkty,
  akcjaZapiszPoprawna,
  akcjaOznaczRozliczone,
}) {
  const router = useRouter();
  const [punkty, setPunkty] = useState(() => {
    const m = {};
    for (const o of odpowiedzi) m[o.id] = o.points ?? 0;
    return m;
  });
  const [poprawna, setPoprawna] = useState(pytanie.correct_answer ?? '');
  const [pendingPunkty, startPunkty] = useTransition();
  const [pendingPoprawna, startPoprawna] = useTransition();
  const [pendingFinish, startFinish] = useTransition();
  const [komunikat, setKomunikat] = useState(null);

  const zapiszWszystkie = () => {
    const lista = Object.entries(punkty).map(([answerId, p]) => ({
      answerId: Number(answerId),
      points: Number(p) || 0,
    }));
    startPunkty(async () => {
      const res = await akcjaZapiszPunkty(lista);
      setKomunikat(res);
      if (res?.ok) router.refresh();
    });
  };

  const zapiszPoprawnaH = () => {
    const fd = new FormData();
    fd.set('question_type', pytanie.question_type);
    fd.set('correct_answer', poprawna);
    startPoprawna(async () => {
      const res = await akcjaZapiszPoprawna(null, fd);
      setKomunikat(res);
      if (res?.ok) router.refresh();
    });
  };

  const oznaczRozliczoneH = () => {
    if (
      !confirm(
        'Oznaczyć pytanie jako rozliczone? Odpowiedzi userów dostaną widoczne punkty na liście rankingu.',
      )
    )
      return;
    startFinish(async () => {
      const res = await akcjaOznaczRozliczone();
      setKomunikat(res);
      if (res?.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold text-emerald-100">
          Poprawna odpowiedź (referencja)
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={poprawna}
            onChange={(e) => setPoprawna(e.target.value)}
            placeholder={
              pytanie.question_type === 'number' ? 'np. 12' : 'np. Robert Lewandowski'
            }
            className="min-w-0 flex-1 rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          />
          <Button
            variant="secondary"
            disabled={pendingPoprawna || !poprawna.trim()}
            onClick={zapiszPoprawnaH}
          >
            {pendingPoprawna ? 'Zapisuję…' : 'Zapisz'}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-emerald-100">
          Odpowiedzi userów ({odpowiedzi.length})
        </h2>
        {odpowiedzi.length === 0 ? (
          <p className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 px-6 py-8 text-center text-emerald-200/60">
            Brak odpowiedzi userów na to pytanie.
          </p>
        ) : (
          <ul className="space-y-2">
            {odpowiedzi.map((o) => (
              <li
                key={o.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-emerald-900/40 bg-emerald-900/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-emerald-50">
                    {o.profil?.nick ?? 'user'}
                  </div>
                  <div className="truncate text-sm text-emerald-200/70">
                    {o.answer_text || (
                      <span className="text-emerald-200/40">— brak —</span>
                    )}
                  </div>
                </div>
                <input
                  type="number"
                  value={punkty[o.id] ?? 0}
                  onChange={(e) =>
                    setPunkty((p) => ({ ...p, [o.id]: e.target.value }))
                  }
                  min={0}
                  className="w-20 rounded-md border border-emerald-800/60 bg-emerald-950/50 px-2 py-1.5 text-right text-emerald-50 outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPunkty((p) => ({ ...p, [o.id]: pytanie.max_points }))
                  }
                  className="rounded-md border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/10"
                  title={`Wpisz maksimum (${pytanie.max_points})`}
                >
                  max
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {komunikat?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {komunikat.error}
        </p>
      )}
      {komunikat?.ok && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          {komunikat.ok}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={zapiszWszystkie}
          disabled={pendingPunkty || odpowiedzi.length === 0}
        >
          {pendingPunkty ? 'Zapisuję…' : 'Zapisz wszystkie punkty'}
        </Button>
        <Button
          variant="secondary"
          onClick={oznaczRozliczoneH}
          disabled={pendingFinish || pytanie.is_settled}
        >
          {pendingFinish
            ? 'Oznaczam…'
            : pytanie.is_settled
              ? 'Już rozliczone'
              : 'Oznacz jako rozliczone'}
        </Button>
      </div>
    </div>
  );
}

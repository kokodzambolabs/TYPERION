'use client';

// Przycisk "🚀 Wymuś teraz" - ręcznie odpala to, co robi cron botów AI
// (Server Action wymusGenerowanieBotow). Pokazuje wynik: ile typów
// wygenerowano, ile błędów, ile pominięto + listę.

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import { wymusGenerowanieBotow } from '@/app/akcje/ai-boty';

export default function PanelWymusCron() {
  const [pending, start] = useTransition();
  const [wynik, setWynik] = useState(null);

  const onClick = () => {
    setWynik(null);
    start(async () => {
      const r = await wymusGenerowanieBotow();
      setWynik(r);
    });
  };

  return (
    <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-50">Wymuś teraz</h2>
          <p className="text-sm text-emerald-200/70">
            Odpala boty na meczach z okna 60–90 min od teraz, bez czekania na
            cron. Może chwilę potrwać (Gemini ponawia próby do ~230s).
          </p>
        </div>
        <Button onClick={onClick} disabled={pending}>
          {pending ? 'Generuję…' : '🚀 Wymuś teraz'}
        </Button>
      </div>

      {pending && (
        <p className="mt-3 rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
          ⏳ Trwa generowanie… Wynik pojawi się tutaj po zakończeniu wszystkich
          wywołań.
        </p>
      )}

      {wynik && <Wynik wynik={wynik} />}
    </section>
  );
}

function Wynik({ wynik }) {
  if (wynik.error) {
    return (
      <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
        ❌ {wynik.error}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {wynik.message && (
        <p className="rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100">
          {wynik.message}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Wytypowano" value={wynik.processed ?? 0} kolor="emerald" />
        <Stat label="Błędy" value={wynik.errors ?? 0} kolor="red" />
        <Stat label="Pominięto" value={wynik.skipped ?? 0} kolor="amber" />
      </div>
      {(wynik.results || []).length > 0 && (
        <ol className="space-y-1 text-xs">
          {wynik.results.map((r, i) => (
            <li
              key={i}
              className={`rounded-md border px-3 py-1.5 ${
                r.error
                  ? 'border-rose-700/40 bg-rose-950/30 text-rose-100'
                  : 'border-emerald-700/40 bg-emerald-950/40 text-emerald-100'
              }`}
            >
              {r.error ? '❌' : '✅'} <strong>{r.bot}</strong> · {r.match}
              {r.error ? (
                <span className="ml-1 text-rose-200">— {r.error}</span>
              ) : (
                <>
                  {' '}
                  — {r.typ}
                  {typeof r.cost === 'number' && (
                    <span className="ml-1 text-emerald-300/70">
                      (${r.cost.toFixed(4)})
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value, kolor }) {
  const klasy = {
    emerald: 'border-emerald-700/40 bg-emerald-950/40 text-emerald-100',
    red: 'border-rose-700/40 bg-rose-950/30 text-rose-100',
    amber: 'border-amber-600/40 bg-amber-950/30 text-amber-100',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${klasy[kolor] || klasy.emerald}`}>
      <div className="text-xs uppercase tracking-wide text-emerald-200/60">
        {label}
      </div>
      <div className="font-mono text-lg font-bold">{value}</div>
    </div>
  );
}

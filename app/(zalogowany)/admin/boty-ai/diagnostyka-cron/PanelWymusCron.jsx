'use client';

// Przycisk "🚀 Wymuś teraz" - ręcznie zleca to, co robi cron botów AI
// (Server Action wymusGenerowanieBotow). Server Action czeka aż wszystkie
// child requesty zakończą się (Promise.all + per-fetch timeout 270s), więc
// kliknięcie wisi do ~5 min. W zamian widać liczbę sukcesów/błędów od ręki.

import { useState, useTransition } from 'react';
import Link from 'next/link';
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
            Zleca boty na meczach z okna 0–120 min od teraz, bez czekania na
            cron. Akcja wisi aż wszystkie boty skończą (do ~5 min) - zobaczysz
            ile typów sukces / błąd od razu.
          </p>
        </div>
        <Button onClick={onClick} disabled={pending}>
          {pending ? 'Zlecam…' : '🚀 Wymuś teraz'}
        </Button>
      </div>

      {pending && (
        <p className="mt-3 rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
          ⏳ Zlecam zadania…
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
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Stat label="Zlecone" value={wynik.zlecone ?? 0} kolor="emerald" />
        <Stat label="Sukcesy" value={wynik.sukcesy ?? 0} kolor="emerald" />
        <Stat label="Błędy" value={wynik.bledy ?? 0} kolor={wynik.bledy ? 'red' : 'emerald'} />
        <Stat label="Pominięto" value={wynik.skipped ?? 0} kolor="amber" />
        <Stat
          label="Mecze × boty"
          value={`${wynik.total_matches ?? 0} × ${wynik.total_bots ?? 0}`}
          kolor="emerald"
        />
      </div>
      {(wynik.zlecone ?? 0) > 0 && (
        <p className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
          🤖 Pełne typy z parametrami AI znajdziesz w{' '}
          <Link
            href="/admin/boty-ai/logi"
            className="font-semibold underline hover:text-sky-50"
          >
            liście logów
          </Link>
          .
        </p>
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

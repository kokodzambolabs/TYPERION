'use client';

// Formularz wpisywania wyniku meczu. Po submit Server Action zapisuje
// matches.home_score/away_score i automatycznie przelicza punkty
// (zapiszWynikIRozlicz w app/akcje/punkty.js).

import { useActionState } from 'react';
import { zapiszWynikIRozlicz } from '@/app/akcje/punkty';

export default function FormularzWyniku({ matchId, startowyHome, startowyAway }) {
  const [state, action, pending] = useActionState(zapiszWynikIRozlicz, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="matchId" value={matchId} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <label
            htmlFor="homeScore"
            className="mb-1 text-xs font-semibold text-emerald-200/80"
          >
            Gospodarze
          </label>
          <input
            id="homeScore"
            type="number"
            name="homeScore"
            inputMode="numeric"
            min={0}
            max={20}
            required
            defaultValue={startowyHome ?? ''}
            className="w-24 rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-center text-xl font-mono text-emerald-50 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <span className="mt-6 text-emerald-300/60">:</span>
        <div className="flex flex-col">
          <label
            htmlFor="awayScore"
            className="mb-1 text-xs font-semibold text-emerald-200/80"
          >
            Goście
          </label>
          <input
            id="awayScore"
            type="number"
            name="awayScore"
            inputMode="numeric"
            min={0}
            max={20}
            required
            defaultValue={startowyAway ?? ''}
            className="w-24 rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-center text-xl font-mono text-emerald-50 focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-emerald-100">
        <input
          type="checkbox"
          name="finished"
          value="1"
          defaultChecked
          className="h-4 w-4 rounded border-emerald-700/60 bg-emerald-950/60 accent-emerald-500"
        />
        Ustaw status: zakończony
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? 'Zapisuję...' : 'Zapisz wynik i policz punkty'}
      </button>

      {state?.error && (
        <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">
          {state.error}
        </p>
      )}
    </form>
  );
}

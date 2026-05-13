'use client';

// Tabela rankingu (client) - trzy kolumny punktów + checkbox "Ukryj boty AI".
// Wiersze przychodzą POSORTOWANE z serwera (po total_points, potem match_points).
// Pozycję wyliczamy TUTAJ - po odfiltrowaniu botów numeracja 1, 2, 3...
// leci wśród ludzi (bez "dziur" po botach).
// Top 3 z kolorowym tłem (złoto/srebro/brąz). Wiersz aktualnego usera
// dostaje wyróżnioną ramkę. Na małych ekranach kolumny "bonus / mecze"
// chowamy - zostawiamy tylko sumę.
// Każdy nick to link do /uzytkownik/[id] - profil + historia typów.

import { useMemo } from 'react';
import Link from 'next/link';
import { useUkryjAI } from '@/lib/hooks/useUkryjAI';

const TLO_TOP = {
  1: 'bg-yellow-500/15 border-yellow-400/40',
  2: 'bg-zinc-300/10 border-zinc-300/30',
  3: 'bg-amber-700/15 border-amber-600/40',
};

const KOLOR_POZYCJI = {
  1: 'text-yellow-300',
  2: 'text-zinc-200',
  3: 'text-amber-400',
};

export default function TabelaRankingu({ wiersze, aktualnyUserId }) {
  const { ukryjAI, setUkryjAI } = useUkryjAI();

  const widoczne = useMemo(() => {
    const baza = ukryjAI ? wiersze.filter((w) => !w.is_bot) : wiersze;
    // Pozycję przeliczamy od nowa - po filtrze numeracja jest ciągła.
    return baza.map((w, i) => ({ ...w, pozycja: i + 1 }));
  }, [wiersze, ukryjAI]);

  const sąBoty = wiersze.some((w) => w.is_bot);

  return (
    <div className="space-y-3">
      {sąBoty && (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-100">
          <input
            type="checkbox"
            checked={ukryjAI}
            onChange={(e) => setUkryjAI(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-emerald-700/60 bg-emerald-950/50 text-emerald-500"
          />
          🤖 Ukryj AI
        </label>
      )}

      {!widoczne || widoczne.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak userów
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-emerald-900/40 bg-emerald-900/10">
          <table className="w-full text-sm text-emerald-100">
            <thead className="bg-emerald-900/40 text-xs uppercase tracking-wide text-emerald-200/80">
              <tr>
                <th className="px-3 py-3 text-left">#</th>
                <th className="px-3 py-3 text-left">Nick</th>
                <th className="hidden px-3 py-3 text-right sm:table-cell">Bonus</th>
                <th className="hidden px-3 py-3 text-right sm:table-cell">Mecze</th>
                <th className="px-3 py-3 text-right">Suma</th>
              </tr>
            </thead>
            <tbody>
              {widoczne.map((w) => {
                const tloTop = TLO_TOP[w.pozycja] || '';
                const moj = w.user_id === aktualnyUserId;
                const klasaWiersza = [
                  'border-t border-emerald-900/30',
                  tloTop,
                  moj ? 'ring-2 ring-emerald-400/60' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <tr key={w.user_id} className={klasaWiersza}>
                    <td className="px-3 py-3">
                      <span
                        className={`font-mono font-semibold ${
                          KOLOR_POZYCJI[w.pozycja] || 'text-emerald-200/80'
                        }`}
                      >
                        {w.pozycja}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <Link
                          href={`/uzytkownik/${w.user_id}`}
                          className="font-semibold text-emerald-50 transition hover:text-emerald-200 hover:underline"
                        >
                          {w.nick}
                          {w.is_bot && (
                            <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                              AI
                            </span>
                          )}
                          {moj && (
                            <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-200">
                              Ty
                            </span>
                          )}
                        </Link>
                        <span className="text-xs text-emerald-200/60 sm:hidden">
                          bonus {w.bonus_points} · mecze {w.match_points}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-right font-mono text-emerald-100/90 sm:table-cell">
                      {w.bonus_points}
                    </td>
                    <td className="hidden px-3 py-3 text-right font-mono text-emerald-100/90 sm:table-cell">
                      {w.match_points}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-mono text-base font-bold text-emerald-50">
                        {w.total_points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

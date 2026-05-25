'use client';

// Panel z listą cudzych typów (tabela z nickami i wynikami).
// Stan (otwarte / lazy fetch) jest po stronie rodzica (KartaMeczu),
// żeby przycisk-toggler mógł siedzieć inline w prawej kolumnie głównego
// rządu, a panel rozwijany leciał pełną szerokością pod nim.
// Default export zachowuje stary import `SekcjaCudzychTypow`, ale to teraz
// czysty panel - kontrolowany przez propsy.

import Link from 'next/link';
import BadgePunktow from './BadgePunktow';
import { czyPucharowy } from '@/lib/helpers/etapMeczu';

export default function PanelCudzychTypow({ pending, blad, typy, mecz }) {
  return (
    <div className="mt-2 rounded-lg border border-emerald-900/40 bg-emerald-950/40 p-2">
      {pending && (
        <p className="px-2 py-2 text-xs text-emerald-300/70">Ładuję…</p>
      )}
      {blad && !pending && (
        <p className="px-2 py-2 text-xs text-rose-300">{blad}</p>
      )}
      {!pending && !blad && typy && typy.length === 0 && (
        <p className="px-2 py-2 text-xs text-emerald-300/70">
          Nikt inny jeszcze nie typował tego meczu.
        </p>
      )}
      {!pending && !blad && typy && typy.length > 0 && <Tabela typy={typy} mecz={mecz} />}
    </div>
  );
}

function Tabela({ typy, mecz }) {
  const pucharowy = mecz && czyPucharowy(mecz.group_name);

  return (
    <ul className="divide-y divide-emerald-900/40">
      {typy.map((t, i) => {
        const remis = t.home === t.away;
        const pokazAwans = pucharowy && remis && t.winnerTeamId != null;
        let winnerTeamName = null;

        if (pokazAwans && mecz) {
          if (t.winnerTeamId === mecz.home_team_id) {
            winnerTeamName = mecz.home_team?.name || `#${mecz.home_team_id}`;
          } else if (t.winnerTeamId === mecz.away_team_id) {
            winnerTeamName = mecz.away_team?.name || `#${mecz.away_team_id}`;
          }
        }

        // Wizualizacja trafienia awansującego (tylko gdy mecz rozliczony)
        let awansClass = '';
        if (pokazAwans && t.points != null && mecz.winner_team_id != null) {
          if (t.winnerTeamId === mecz.winner_team_id) {
            awansClass = 'text-emerald-300'; // trafiony
          } else {
            awansClass = 'text-rose-300'; // pudło
          }
        }

        return (
          <li
            key={`${t.nick}-${i}`}
            className={`px-2 py-1.5 ${t.isBot ? 'bg-sky-950/30' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
              <Link
                href={t.userId ? `/uzytkownik/${t.userId}` : '#'}
                className="min-w-0 flex-1 truncate font-semibold text-emerald-200 hover:text-emerald-50 hover:underline"
                title={t.nick}
              >
                {t.nick}
                {t.isBot && (
                  <span className="ml-1.5 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                    AI
                  </span>
                )}
              </Link>
              <span className="shrink-0 rounded bg-emerald-900/50 px-1.5 py-0.5 font-mono text-emerald-50">
                {t.home}:{t.away}
              </span>
              {pokazAwans && winnerTeamName && (
                <span className={`shrink-0 text-xs ${awansClass}`}>
                  {t.points != null ? (
                    awansClass === 'text-emerald-300' ? '✓' : '✗'
                  ) : null}
                  {' '}
                  awans: <span className="font-semibold">{winnerTeamName}</span>
                </span>
              )}
              <span className="shrink-0">
                {t.points != null ? (
                  <BadgePunktow punkty={t.points} />
                ) : (
                  <span className="text-emerald-300/60">— czeka</span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

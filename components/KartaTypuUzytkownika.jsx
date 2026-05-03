// Karta meczu na profilu usera (/uzytkownik/[id]) - JEDNA LINIA, kompaktowa.
// [meta: data + grupa + LIVE] [DrużynaA | wynik | DrużynaB] [Typ + punkty | F]
//
// To lista do scrollowania (cała historia typów), więc trzymamy mniejsze
// odstępy niż w /mecze (px-3 py-1.5). Bez akcji typu Zapisz / Cudze typy -
// to tylko wyświetlanie. Mobile: zwija się na 2 linie przez flex-wrap.
//
// "ukryte" = cudzy typ na mecz nadchodzący - musi pozostać niewidoczny
// (defense in depth na cudzą prywatność typów).

import BadgePunktow from './BadgePunktow';
import { formatujDateKrotkoPL, formatGrupa } from '@/lib/format';
import { getFlashscoreUrl } from '@/lib/competitions';

export default function KartaTypuUzytkownika({ mecz, typ, ukryte, stan }) {
  const home = mecz.home_team?.name || `#${mecz.home_team_id}`;
  const away = mecz.away_team?.name || `#${mecz.away_team_id}`;
  const flashscoreUrl = getFlashscoreUrl(mecz.competition_code);
  const grupaEtykieta = formatGrupa(mecz.group_name);
  const maWynik = mecz.home_score != null && mecz.away_score != null;
  const live = stan === 'live';

  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-900/20 px-3 py-1.5 sm:py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        {/* Lewa: meta */}
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-200/70">
          <span className="whitespace-nowrap font-medium">
            {formatujDateKrotkoPL(mecz.kickoff_at)}
          </span>
          {live && (
            <span className="animate-pulse whitespace-nowrap rounded-md border border-rose-500/50 bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-bold text-rose-100">
              🔴 LIVE
            </span>
          )}
          {grupaEtykieta && (
            <span className="whitespace-nowrap rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-100">
              {grupaEtykieta}
            </span>
          )}
        </div>

        {/* Centrum: drużyny + wynik */}
        <div className="order-3 flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
          <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-emerald-50 sm:text-base">
            {home}
          </span>
          <span
            className={`shrink-0 rounded-md px-2 py-1 font-mono text-base font-bold ${
              live
                ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : maWynik
                  ? 'bg-emerald-800/40 text-emerald-100'
                  : 'border border-emerald-700/40 bg-emerald-950/40 text-emerald-300/70'
            }`}
          >
            {maWynik ? `${mecz.home_score} : ${mecz.away_score}` : '— : —'}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-emerald-50 sm:text-base">
            {away}
          </span>
        </div>

        {/* Prawa: typ + punkty + F */}
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-0 sm:flex-nowrap">
          {ukryte ? (
            <span className="whitespace-nowrap text-xs italic text-emerald-300/60">
              🔒 typ ukryty
            </span>
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
              <span className="text-emerald-200/80">
                Typ:{' '}
                <span className="font-mono text-emerald-100">
                  {typ.home_score}:{typ.away_score}
                </span>
              </span>
              {stan === 'finished' &&
                (typ.points != null ? (
                  <BadgePunktow punkty={typ.points} />
                ) : (
                  <span className="text-emerald-200/50">(czeka)</span>
                ))}
            </span>
          )}
          {flashscoreUrl && (
            <a
              href={flashscoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Otwórz turniej w Flashscore"
              aria-label="Otwórz turniej w Flashscore"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-blue-600 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              F
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

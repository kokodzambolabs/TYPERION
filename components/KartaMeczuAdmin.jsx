// Karta meczu w panelu admina - JEDNA LINIA na desktop.
// [meta: data + status + grupa] [DrużynaA | wynik | DrużynaB] [F | Wynik | Edytuj | Usuń]
// Mobile: zwija się przez flex-wrap (centrum łapie basis-full + order).
//
// Nowość: przycisk Flashscore (F) - duży niebieski kwadrat w-10 h-10
// po prawej stronie, zamiast wcześniejszej małej ikony w rogu.
// Dla MŚ/ME pokazujemy badge z grupą lub etapem.
//
// `poKickoff` przekazujemy z Server Componentu, żeby uniknąć Date.now() w
// trakcie renderu. `sierota` = mecz powinien być po (kickoff + 3h minęło),
// ale brakuje wyniku - badge "⚠️ brak wyniku".

import Link from 'next/link';
import StatusBadge from './StatusBadge';
import PrzyciskUsun from './PrzyciskUsun';
import { formatujDateKrotkoPL, formatGrupa } from '@/lib/format';
import { getFlashscoreUrl } from '@/lib/competitions';
import { usunMecz } from '@/app/akcje/mecze';

export default function KartaMeczuAdmin({ mecz, poKickoff = false, sierota = false }) {
  const home = mecz.home_team?.name || `#${mecz.home_team_id}`;
  const away = mecz.away_team?.name || `#${mecz.away_team_id}`;
  const maWynik = mecz.home_score != null && mecz.away_score != null;
  const zablokowanaEdycja = mecz.status !== 'scheduled';
  const flashscoreUrl = getFlashscoreUrl(mecz.competition_code);
  const grupaEtykieta = formatGrupa(mecz.group_name);
  // "Wynik" pokazujemy dla meczów które się już rozpoczęły lub zakończyły -
  // czyli wszystkich poza scheduled (no chyba że kickoff_at już minął, ale
  // status jeszcze nie został podbity).
  const pokazPrzyciskWyniku =
    mecz.status === 'live' || mecz.status === 'finished' || poKickoff;

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        {/* Lewa: meta */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-emerald-200/70">
          <span className="whitespace-nowrap font-medium">
            {formatujDateKrotkoPL(mecz.kickoff_at)}
          </span>
          <StatusBadge status={mecz.status} />
          {grupaEtykieta && (
            <span className="whitespace-nowrap rounded bg-emerald-700/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
              {grupaEtykieta}
            </span>
          )}
        </div>

        {/* Centrum: drużyny + wynik */}
        <div className="order-3 flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
          <span
            title={home}
            className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-emerald-50 sm:text-base"
          >
            {home}
          </span>
          {maWynik ? (
            <span className="shrink-0 rounded-md bg-emerald-800/40 px-2 py-1 font-mono text-base font-bold text-emerald-100">
              {mecz.home_score} : {mecz.away_score}
            </span>
          ) : sierota ? (
            <span
              className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100"
              title="Mecz powinien być po, ale w bazie nie ma wyniku."
            >
              ⚠️ brak wyniku
            </span>
          ) : (
            <span className="shrink-0 px-1 text-emerald-300/50">vs</span>
          )}
          <span
            title={away}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-emerald-50 sm:text-base"
          >
            {away}
          </span>
        </div>

        {/* Prawa: akcje */}
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-0 sm:flex-nowrap">
          {flashscoreUrl && (
            <a
              href={flashscoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Otwórz turniej w Flashscore"
              aria-label="Otwórz turniej w Flashscore"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-blue-600 text-lg font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              F
            </a>
          )}
          {pokazPrzyciskWyniku && (
            <Link
              href={`/admin/mecze/${mecz.id}/wynik`}
              className="rounded-md border border-emerald-400/60 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              {maWynik ? 'Edytuj wynik' : 'Wpisz wynik'}
            </Link>
          )}
          {zablokowanaEdycja ? (
            <span
              className="cursor-not-allowed rounded-md border border-emerald-900/40 px-3 py-1.5 text-sm text-emerald-300/40"
              title="Mecz już się rozpoczął - edycja zablokowana"
            >
              Edytuj
            </span>
          ) : (
            <Link
              href={`/admin/mecze/${mecz.id}/edycja`}
              className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-100 transition hover:bg-emerald-500/10"
            >
              Edytuj
            </Link>
          )}
          <PrzyciskUsun
            akcja={usunMecz.bind(null, mecz.id)}
            etykieta={`Usunąć mecz ${home} vs ${away}? (skasuje wszystkie typy userów)`}
          />
        </div>
      </div>
    </div>
  );
}

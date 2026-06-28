'use client';

// Karta pojedynczego meczu na liście /mecze - JEDNA LINIA (desktop).
//
// Layout (jeden flex-row):
//   [data + grupa + LIVE]   [Drużyna A | wynik/inputy | Drużyna B]   [typ | F | 👥]
//   ←   shrink-0 (lewo)   ←  flex-1 min-w-0 (centrum)  ←  shrink-0 (prawo)
//
// Mobile (<sm): flex-wrap zwija centrum do drugiej linii (basis-full),
// meta zostaje na górze po lewej, akcje po prawej (ml-auto).
//
// Stany:
//   - 'scheduled'   inputy + przycisk Zapisz (form action=zapiszTyp)
//   - 'live'        aktualny wynik + Twój typ + 👥 Typy (toggle)
//   - 'finished'    końcowy wynik + Twój typ + punkty + 👥 Typy (toggle)
//
// Cudze typy: state lifted tutaj, żeby przycisk siedział inline w akcjach,
// a panel rozwijany leciał pełną szerokością pod głównym rządem
// (nie da się tego osiągnąć trzymając button+panel razem w jednej kolumnie
// flexa). Lazy fetch: pobranie dopiero przy pierwszym otwarciu.
//
// Bug naprawiony (zostaje): po Server Action zapiszTyp UI od razu pokazuje
// świeży typ - state z action ma pierwszeństwo nad propem; "✓ Zapisano"
// flashuje przez 2s dzięki CSS keyframes (flash-zapisano w globals.css).

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import BadgePunktow from './BadgePunktow';
import PanelCudzychTypow from './SekcjaCudzychTypow';
import { formatujDateKrotkoPL, formatGrupa } from '@/lib/format';
import { getFlashscoreUrl } from '@/lib/competitions';
import { zapiszTyp, pobierzCudzeTypy } from '@/app/akcje/typy';
import { useUkryjAI } from '@/lib/hooks/useUkryjAI';
import { czyPucharowy, etykietaEtapu } from '@/lib/helpers/etapMeczu';

export default function KartaMeczu({ mecz, typ, stan, anchorId }) {
  const home = mecz.home_team?.name || `#${mecz.home_team_id}`;
  const away = mecz.away_team?.name || `#${mecz.away_team_id}`;
  const flashscoreUrl = getFlashscoreUrl(mecz.competition_code);
  const grupaEtykieta = formatGrupa(mecz.group_name);
  const pokazCudze = stan === 'live' || stan === 'finished';

  const [otwarteCudze, setOtwarteCudze] = useState(false);
  const [cudzeTypy, setCudzeTypy] = useState(null);
  const [bladCudze, setBladCudze] = useState(null);
  const [pendingCudze, startCudze] = useTransition();
  const { ukryjAI } = useUkryjAI();

  // Filtr "Ukryj AI" jest dzielony z /ranking przez localStorage - jeśli
  // user zaznaczył checkbox na rankingu, boty znikają też z cudzych typów.
  const widoczneCudze = useMemo(() => {
    if (!cudzeTypy) return null;
    return ukryjAI ? cudzeTypy.filter((t) => !t.isBot) : cudzeTypy;
  }, [cudzeTypy, ukryjAI]);
  const liczbaInnych = widoczneCudze ? widoczneCudze.length : null;

  const przelaczCudze = () => {
    if (otwarteCudze) {
      setOtwarteCudze(false);
      return;
    }
    setOtwarteCudze(true);
    if (cudzeTypy === null && !pendingCudze) {
      setBladCudze(null);
      startCudze(async () => {
        const res = await pobierzCudzeTypy({ matchId: mecz.id });
        if (res.error) {
          setBladCudze(res.error);
          setCudzeTypy([]);
          return;
        }
        setCudzeTypy(res.typy || []);
      });
    }
  };

  return (
    <div
      id={anchorId}
      className="rounded-lg border border-emerald-900/40 bg-emerald-900/20 px-3 py-2 sm:px-4 sm:py-2.5"
    >
      {stan === 'scheduled' && (
        <RzadScheduled
          mecz={mecz}
          typ={typ}
          home={home}
          away={away}
          grupaEtykieta={grupaEtykieta}
          flashscoreUrl={flashscoreUrl}
          pucharowy={czyPucharowy(mecz.group_name)}
          etykietaPucharu={etykietaEtapu(mecz.group_name)}
        />
      )}

      {(stan === 'live' || stan === 'finished') && (
        <RzadGotowy
          mecz={mecz}
          typ={typ}
          home={home}
          away={away}
          grupaEtykieta={grupaEtykieta}
          flashscoreUrl={flashscoreUrl}
          stan={stan}
          przelaczCudze={pokazCudze ? przelaczCudze : null}
          otwarteCudze={otwarteCudze}
          liczbaInnych={liczbaInnych}
        />
      )}

      {pokazCudze && otwarteCudze && (
        <PanelCudzychTypow
          pending={pendingCudze}
          blad={bladCudze}
          typy={widoczneCudze}
          mecz={mecz}
        />
      )}
    </div>
  );
}

// Lewy blok meta: data + opcjonalnie grupa + opcjonalnie LIVE badge.
function Meta({ kickoff, grupaEtykieta, live }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-200/70">
      <span className="whitespace-nowrap font-medium">
        {formatujDateKrotkoPL(kickoff)}
      </span>
      {live && (
        <span className="animate-pulse whitespace-nowrap rounded-md border border-rose-500/50 bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-bold text-rose-100">
          🔴 LIVE
        </span>
      )}
      {grupaEtykieta && (
        <span className="whitespace-nowrap rounded bg-emerald-700/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
          {grupaEtykieta}
        </span>
      )}
    </div>
  );
}

// Niebieski kwadrat "F" otwierający turniej w Flashscore.
// w-10 h-10 - świadomie duży, ma być wyróżniony (spec).
function PrzyciskFlashscore({ url }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Otwórz turniej w Flashscore"
      aria-label="Otwórz turniej w Flashscore"
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-blue-600 text-lg font-bold text-white shadow-sm transition hover:bg-blue-700"
    >
      F
    </a>
  );
}

// Inline SVG w stylu lucide-react (24x24, stroke=currentColor).
// Trzymamy lokalnie - lucide-react to dodatkowa zależność tylko dla 3 ikonek.
function IkonaCheck({ className = 'h-5 w-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IkonaPencil({ className = 'h-5 w-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IkonaSpinner({ className = 'h-5 w-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} animate-spin`}
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Layout (scheduled): [meta] [DrużynaA | inputy | DrużynaB] [F | Zapisz]
// Mobile: meta + akcje na górze, centrum (drużyny+inputy) zwija się
// na drugą linię przez basis-full + order.
// Pucharowy: dropdown "Kto awansuje?" gdy remis w 90min.
// ---------------------------------------------------------------------
function RzadScheduled({ mecz, typ, home, away, grupaEtykieta, flashscoreUrl, pucharowy, etykietaPucharu }) {
  const [state, action, pending] = useActionState(zapiszTyp, null);

  const aktualnyTyp = (state?.ok && state?.typ) ? state.typ : (typ ?? null);

  // Inputy KONTROLOWANE (value, nie defaultValue) - dzięki temu widoczność
  // dropdownu "Kto awansuje?" liczymy z AKTUALNEGO state'u, a nie z wartości
  // początkowej. Wynik trzymamy jako string (inputy zwracają string).
  const [localHome, setLocalHome] = useState(() => String(typ?.home_score ?? ''));
  const [localAway, setLocalAway] = useState(() => String(typ?.away_score ?? ''));
  const [winnerId, setWinnerId] = useState(typ?.winner_team_id ?? null);

  // Synchronizacja PO udanym zapisie - tylko gdy zmieni się savedAt (nowy
  // zapis), nie przy każdym renderze. To kluczowe: poprzednio porównywaliśmy
  // local* z zapisanym typem przy każdym renderze, więc edycja inputu (np.
  // 1:0 -> 1:1) była natychmiast cofana (BUG 2), a wybór awansującego znikał
  // po zapisie (BUG 1). Teraz wartość z bazy nadpisuje local* dokładnie raz,
  // przy świeżym sukcesie Server Action.
  const [ostatniSave, setOstatniSave] = useState(null);
  if (state?.ok && state.savedAt && state.savedAt !== ostatniSave) {
    setOstatniSave(state.savedAt);
    setLocalHome(String(state.typ.home_score ?? ''));
    setLocalAway(String(state.typ.away_score ?? ''));
    setWinnerId(state.typ.winner_team_id ?? null);
  }

  const remis =
    localHome !== '' && localAway !== '' && Number(localHome) === Number(localAway);
  const pokazDropdown = pucharowy && remis;

  // Gdy wynik przestaje być remisem, czyścimy wybór awansującego - inaczej
  // ukryty hidden input trzymałby starą wartość winner_team_id i server
  // odrzucałby zapis ("Wybór awansującego dotyczy tylko remisu...").
  useEffect(() => {
    if (!remis && winnerId !== null) {
      setWinnerId(null);
    }
  }, [remis, winnerId]);

  return (
    <form action={action}>
      <input type="hidden" name="matchId" value={mecz.id} />
      <input type="hidden" name="winnerId" value={winnerId ?? ''} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        <Meta kickoff={mecz.kickoff_at} grupaEtykieta={grupaEtykieta} live={false} />

        {pucharowy && etykietaPucharu && (
          <span className="text-xs font-semibold text-emerald-300 italic">{etykietaPucharu}</span>
        )}

        <div className="order-3 flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
          <span
            title={home}
            className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-emerald-50 sm:text-base"
          >
            {home}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="number"
              name="homeScore"
              inputMode="numeric"
              min={0}
              max={20}
              required
              value={localHome}
              placeholder="—"
              onChange={(e) => setLocalHome(e.target.value)}
              className="h-9 w-11 rounded-md border border-emerald-700/60 bg-emerald-950/60 text-center font-mono text-base text-emerald-50 placeholder-emerald-300/30 focus:border-emerald-400 focus:outline-none"
              aria-label={`Typ ${home}`}
            />
            <span className="text-emerald-300/70">:</span>
            <input
              type="number"
              name="awayScore"
              inputMode="numeric"
              min={0}
              max={20}
              required
              value={localAway}
              placeholder="—"
              onChange={(e) => setLocalAway(e.target.value)}
              className="h-9 w-11 rounded-md border border-emerald-700/60 bg-emerald-950/60 text-center font-mono text-base text-emerald-50 placeholder-emerald-300/30 focus:border-emerald-400 focus:outline-none"
              aria-label={`Typ ${away}`}
            />
          </div>
          <span
            title={away}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-emerald-50 sm:text-base"
          >
            {away}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <PrzyciskFlashscore url={flashscoreUrl} />
          {/* Zapis/edycja - same ikony, w-10 h-10 jak F. Po sukcesie
              overlay flash-zapisano-button przykrywa przycisk na 2s
              (zielony pulsujący ✓), potem znika i widać przycisk pod spodem
              (który po pierwszym zapisie jest już w trybie "edytuj"). */}
          <div className="relative">
            <button
              type="submit"
              disabled={pending}
              title={aktualnyTyp ? 'Zaktualizuj typ' : 'Zapisz typ'}
              aria-label={aktualnyTyp ? 'Zaktualizuj typ' : 'Zapisz typ'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-md text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                aktualnyTyp
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {pending ? (
                <IkonaSpinner />
              ) : aktualnyTyp ? (
                <IkonaPencil />
              ) : (
                <IkonaCheck />
              )}
            </button>
            {state?.ok && !state?.error && (
              <span
                key={state.savedAt}
                aria-hidden
                title="✓ Zapisano!"
                className="flash-zapisano-button pointer-events-none absolute inset-0 inline-flex items-center justify-center rounded-md bg-emerald-500 text-white shadow-md shadow-emerald-500/50"
              >
                <IkonaCheck />
              </span>
            )}
          </div>
        </div>
      </div>

      {pokazDropdown && (
        <div className="mt-2 space-y-1">
          <label className="block text-xs font-semibold text-emerald-200">
            Kto awansuje?
          </label>
          <select
            value={winnerId ?? ''}
            onChange={(e) => setWinnerId(e.target.value ? Number(e.target.value) : null)}
            required
            className="w-full rounded-md border border-emerald-600/60 bg-emerald-950/60 px-2 py-1.5 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
          >
            <option value="">— wybierz drużynę —</option>
            <option value={mecz.home_team_id}>{home}</option>
            <option value={mecz.away_team_id}>{away}</option>
          </select>
          <p className="text-xs text-emerald-300/70">
            Awansująca drużyna = +1 pkt jeśli trafisz
          </p>
        </div>
      )}

      {state?.error && (
        <p className="mt-1 text-xs text-rose-300">{state.error}</p>
      )}
      {state?.ok && !state?.error && (
        <p
          key={state.savedAt}
          className="flash-zapisano sr-only mt-1 text-xs font-semibold text-emerald-300"
        >
          ✓ Zapisano
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------
// Layout (live/finished): [meta] [DrużynaA | wynik | DrużynaB] [typ | F | 👥]
// Dla "sierot" (kickoff_at + 3h minęło, ale brak wpisanego wyniku)
// pokazujemy badge "⚠️ Wynik niedostępny" zamiast wyniku.
// ---------------------------------------------------------------------
function RzadGotowy({
  mecz,
  typ,
  home,
  away,
  grupaEtykieta,
  flashscoreUrl,
  stan,
  przelaczCudze,
  otwarteCudze,
  liczbaInnych,
}) {
  const live = stan === 'live';
  const maWynik = mecz.home_score != null && mecz.away_score != null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
      <Meta kickoff={mecz.kickoff_at} grupaEtykieta={grupaEtykieta} live={live} />

      <div className="order-3 flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
        <span
          title={home}
          className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-emerald-50 sm:text-base"
        >
          {home}
        </span>
        {maWynik ? (
          <span
            className={
              live
                ? 'shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-mono text-base font-bold text-emerald-100'
                : 'shrink-0 rounded-md bg-emerald-800/40 px-2 py-1 font-mono text-base font-bold text-emerald-100'
            }
          >
            {mecz.home_score} : {mecz.away_score}
          </span>
        ) : (
          <span
            className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100"
            title="Mecz powinien być po, ale w bazie nie ma wyniku."
          >
            ⚠️ brak wyniku
          </span>
        )}
        <span
          title={away}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-emerald-50 sm:text-base"
        >
          {away}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-0 sm:flex-nowrap">
        <TypInline typ={typ} stan={stan} mecz={mecz} />
        <PrzyciskFlashscore url={flashscoreUrl} />
        {przelaczCudze && (
          <button
            type="button"
            onClick={przelaczCudze}
            aria-expanded={otwarteCudze}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-900/30 px-2 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-900/50"
          >
            <span aria-hidden>👥</span>
            <span className="whitespace-nowrap">
              Typy
              {liczbaInnych != null && (
                <span className="ml-0.5 text-emerald-300/70">
                  ({liczbaInnych})
                </span>
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// "Typ: X:Y" + ewentualnie BadgePunktow (finished). Inline w prawej kolumnie.
function TypInline({ typ, stan, mecz }) {
  if (!typ) {
    return (
      <span
        className={`whitespace-nowrap text-xs italic ${
          stan === 'live' ? 'text-amber-200/60' : 'text-emerald-200/50'
        }`}
      >
        — nie typowałeś
      </span>
    );
  }

  const pucharowy = mecz && czyPucharowy(mecz.group_name);
  const remis = typ.home_score === typ.away_score;
  const pokazAwans = pucharowy && remis && typ.winner_team_id != null && stan === 'finished';

  let winnerTeamName = null;
  if (pokazAwans && mecz) {
    if (typ.winner_team_id === mecz.home_team_id) {
      winnerTeamName = mecz.home_team?.name || `#${mecz.home_team_id}`;
    } else if (typ.winner_team_id === mecz.away_team_id) {
      winnerTeamName = mecz.away_team?.name || `#${mecz.away_team_id}`;
    }
  }

  return (
    <span className="flex flex-col items-end gap-1.5 whitespace-nowrap text-xs">
      <span className={stan === 'live' ? 'text-amber-200/80' : 'text-emerald-200/80'}>
        Typ:{' '}
        <span
          className={`font-mono ${stan === 'live' ? 'text-amber-100' : 'text-emerald-100'}`}
        >
          {typ.home_score}:{typ.away_score}
        </span>
      </span>
      {pokazAwans && winnerTeamName && (
        <span className="text-emerald-300/80">
          awans: <span className="font-semibold">{winnerTeamName}</span>
        </span>
      )}
      {stan === 'finished' &&
        (typ.points != null ? (
          <BadgePunktow punkty={typ.points} />
        ) : (
          <span className="text-emerald-200/50">(czeka)</span>
        ))}
    </span>
  );
}

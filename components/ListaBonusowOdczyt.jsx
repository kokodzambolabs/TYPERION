'use client';

// Tryb tylko-do-odczytu pytań bonusowych (po bonuses_close_at).
// Wcześniej żył inline w app/(zalogowany)/bonusy/page.js jako serwerowy
// komponent - wyrwany do osobnego klienta, żeby per pytanie trzymać
// stan rozwiniętej sekcji "Zobacz odpowiedzi innych" (1:1 wzorzec
// z components/KartaMeczu.jsx + components/SekcjaCudzychTypow.jsx).
//
// Lazy fetch: cudze odpowiedzi pobieramy dopiero przy pierwszym otwarciu
// panelu - przy długiej liście pytań zapytanie do bazy odpada, dopóki
// user nie kliknie togglera.
//
// Filtr "Ukryj AI": dzielony przez localStorage z /ranking i meczami
// (useUkryjAI). Twarde ukrycie bot_ukryty robi serwer; useUkryjAI to tylko
// dodatkowy filtr po stronie klienta (ten sam pattern co cudze typy
// meczowe). bot_ukryty wraca w wynikach tylko dla admina - dla zwykłych
// userów serwer już je wycina, więc widzą tylko jawne boty (i mogą je
// schować checkboxem).

import { useMemo, useState, useTransition } from 'react';
import PanelCudzychOdpowiedzi from './SekcjaCudzychOdpowiedzi';
import { pobierzCudzeOdpowiedziBonusowe } from '@/app/akcje/bonusy';
import { useUkryjAI } from '@/lib/hooks/useUkryjAI';

export default function ListaBonusowOdczyt({
  pytania,
  odpowiedzi,
  teams,
  opcjeMap,
}) {
  const teamNazwa = (id) => teams.find((t) => t.id === id)?.name || `#${id}`;
  return (
    <ul className="space-y-3">
      {pytania.map((p) => (
        <KartaPytania
          key={p.id}
          pytanie={p}
          odp={odpowiedzi[p.id]}
          opcje={opcjeMap?.[p.id] || []}
          teamNazwa={teamNazwa}
        />
      ))}
    </ul>
  );
}

function KartaPytania({ pytanie, odp, opcje, teamNazwa }) {
  const [otwarte, setOtwarte] = useState(false);
  const [cudze, setCudze] = useState(null); // null => jeszcze nie pobrane
  const [blad, setBlad] = useState(null);
  const [isSettledServer, setIsSettledServer] = useState(null);
  const [pending, startCudze] = useTransition();
  const { ukryjAI } = useUkryjAI();

  // Filtr "Ukryj AI" jest dzielony z /ranking przez localStorage - jeśli
  // user zaznaczył checkbox na rankingu, boty znikają też z cudzych odp.
  const widoczne = useMemo(() => {
    if (!cudze) return null;
    const przygotowane = cudze.map((o) => ({
      ...o,
      displayAnswer: formatujOdpowiedz(pytanie, o, teamNazwa, opcje),
    }));
    return ukryjAI ? przygotowane.filter((o) => !o.isBot) : przygotowane;
  }, [cudze, ukryjAI, pytanie, teamNazwa, opcje]);
  const liczbaInnych = widoczne ? widoczne.length : null;

  const przelacz = () => {
    if (otwarte) {
      setOtwarte(false);
      return;
    }
    setOtwarte(true);
    if (cudze === null && !pending) {
      setBlad(null);
      startCudze(async () => {
        const res = await pobierzCudzeOdpowiedziBonusowe({ questionId: pytanie.id });
        if (res.error) {
          setBlad(res.error);
          setCudze([]);
          return;
        }
        setCudze(res.odpowiedzi || []);
        setIsSettledServer(!!res.isSettled);
      });
    }
  };

  const userOdp = formatujOdpowiedzWlasna(pytanie, odp, teamNazwa, opcje);
  const correct = formatujPoprawna(pytanie, teamNazwa, opcje);
  const maxPkt = maxPunkty(pytanie, opcje);
  // Dla wyświetlania punktów w panelu używamy is_settled z serwera, jeśli
  // już pobrane (świeższe niż prop) - inaczej spadamy na is_settled z SSR.
  const isSettled = isSettledServer ?? !!pytanie.is_settled;

  return (
    <li className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-emerald-50">{pytanie.text}</h3>
        <span className="text-xs text-emerald-300/70">do {maxPkt} pkt</span>
      </div>
      {pytanie.description && (
        <p className="mb-2 text-sm text-emerald-200/70">{pytanie.description}</p>
      )}
      <dl className="space-y-1 text-sm text-emerald-100">
        <div className="flex flex-wrap gap-2">
          <dt className="text-emerald-300/70">Twoja odpowiedź:</dt>
          <dd className="font-mono">{userOdp ?? '—'}</dd>
        </div>
        {pytanie.is_settled && (
          <>
            {correct && (
              <div className="flex flex-wrap gap-2">
                <dt className="text-emerald-300/70">Poprawna:</dt>
                <dd className="font-mono">{correct}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <dt className="text-emerald-300/70">Punkty:</dt>
              <dd className="font-semibold">
                {odp?.points ?? 0} / {maxPkt}
              </dd>
            </div>
          </>
        )}
        {!pytanie.is_settled && (
          <p className="text-xs text-emerald-300/60">Czeka na rozliczenie.</p>
        )}
      </dl>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={przelacz}
          aria-expanded={otwarte}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-900/30 px-2 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-900/50"
        >
          <span aria-hidden>👥</span>
          <span className="whitespace-nowrap">
            {otwarte ? 'Ukryj odpowiedzi innych' : 'Zobacz odpowiedzi innych'}
            {liczbaInnych != null && (
              <span className="ml-0.5 text-emerald-300/70">({liczbaInnych})</span>
            )}
          </span>
        </button>
      </div>

      {otwarte && (
        <PanelCudzychOdpowiedzi
          pending={pending}
          blad={blad}
          odpowiedzi={widoczne}
          isSettled={isSettled}
        />
      )}
    </li>
  );
}

// Formatery — wyciągnięte 1:1 z page.js i rozszerzone o wariant dla
// "cudzych" odpowiedzi (z serwera leci selectedOptionId / answerOtherFlag
// w camelCase zamiast snake_case z bazy).

function formatujOdpowiedzWlasna(pytanie, odp, teamNazwa, opcje) {
  if (!odp) return null;
  if (pytanie.question_type === 'team') {
    return odp.answer_team_id ? teamNazwa(odp.answer_team_id) : null;
  }
  if (pytanie.question_type === 'boolean') {
    if (odp.answer_boolean === true) return 'Tak';
    if (odp.answer_boolean === false) return 'Nie';
    return null;
  }
  if (
    pytanie.question_type === 'dropdown_weighted' ||
    pytanie.question_type === 'boolean_weighted' ||
    pytanie.question_type === 'dropdown_other'
  ) {
    if (odp.answer_other_flag) {
      return odp.answer_text ? `Inny: ${odp.answer_text}` : 'Inny';
    }
    if (odp.selected_option_id) {
      const opcja = (opcje || []).find((o) => o.id === odp.selected_option_id);
      return opcja?.opcja_text || odp.answer_text || null;
    }
    return odp.answer_text || null;
  }
  return odp.answer_text || null;
}

// Wariant dla cudzych: ta sama logika, ale wejście w camelCase z server
// action (answerTeamId, selectedOptionId, answerOtherFlag).
function formatujOdpowiedz(pytanie, o, teamNazwa, opcje) {
  if (!o) return null;
  if (pytanie.question_type === 'team') {
    return o.answerTeamId ? teamNazwa(o.answerTeamId) : null;
  }
  if (pytanie.question_type === 'boolean') {
    if (o.answerBoolean === true) return 'Tak';
    if (o.answerBoolean === false) return 'Nie';
    return null;
  }
  if (
    pytanie.question_type === 'dropdown_weighted' ||
    pytanie.question_type === 'boolean_weighted' ||
    pytanie.question_type === 'dropdown_other'
  ) {
    if (o.answerOtherFlag) {
      return o.answerText ? `Inny: ${o.answerText}` : 'Inny';
    }
    if (o.selectedOptionId) {
      const opcja = (opcje || []).find((opt) => opt.id === o.selectedOptionId);
      return opcja?.opcja_text || o.answerText || null;
    }
    return o.answerText || null;
  }
  return o.answerText || null;
}

function formatujPoprawna(pytanie, teamNazwa, opcje) {
  if (pytanie.question_type === 'team') {
    return pytanie.correct_team_id ? teamNazwa(pytanie.correct_team_id) : null;
  }
  if (pytanie.question_type === 'boolean') {
    if (pytanie.correct_boolean === true) return 'Tak';
    if (pytanie.correct_boolean === false) return 'Nie';
    return null;
  }
  if (
    pytanie.question_type === 'dropdown_weighted' ||
    pytanie.question_type === 'boolean_weighted' ||
    pytanie.question_type === 'dropdown_other'
  ) {
    const poprawna = (opcje || []).find((o) => o.is_correct);
    return poprawna?.opcja_text || null;
  }
  return pytanie.correct_answer || null;
}

function maxPunkty(pytanie, opcje) {
  if (
    pytanie.question_type === 'dropdown_weighted' ||
    pytanie.question_type === 'boolean_weighted' ||
    pytanie.question_type === 'dropdown_other'
  ) {
    const maks = (opcje || []).reduce(
      (acc, o) => (o.punkty > acc ? o.punkty : acc),
      0,
    );
    return maks || pytanie.max_points;
  }
  return pytanie.max_points;
}

'use client';

// Formularz pytań bonusowych - osobne pole + przycisk "Zapisz" per pytanie.
// Pojedynczy zapis zamiast jednego dużego submitu - user nie traci pracy
// jeśli wypełni połowę i zamknie kartę. Każdy wiersz to osobna instancja
// PojedynczePytanie (każdy ma swój własny useActionState).
//
// Przycisk zapisu = ikona ✓ w kwadracie w-10 h-10 (taki sam wygląd jak
// przycisk zapisu typu na karcie meczu - patrz components/KartaMeczu.jsx).
// Po sukcesie overlay flash-zapisano-button przykrywa przycisk na 2s
// (zielony pulsujący ✓), tooltip "✓ Zapisano!".

import { useActionState, useState } from 'react';
import { zapiszOdpowiedzBonusowa } from '@/app/akcje/bonusy';

export default function FormularzBonusow({
  questions,
  userAnswers,
  teams,
  opcjeMap,
  isOpen,
}) {
  return (
    <div className="space-y-3">
      {questions.map((q) => {
        const a = userAnswers?.[q.id];
        const reactKey = `${q.id}-${a?.updated_at ?? 'pusta'}`;
        return (
          <PojedynczePytanie
            key={reactKey}
            pytanie={q}
            poczatkowa={a}
            teams={teams}
            opcje={opcjeMap?.[q.id] || []}
            isOpen={isOpen}
          />
        );
      })}
    </div>
  );
}

// Inline SVG check (lucide style) - identyczny jak na karcie meczu.
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

function PojedynczePytanie({ pytanie, poczatkowa, teams, opcje, isOpen }) {
  const [state, action, pending] = useActionState(zapiszOdpowiedzBonusowa, null);
  const zapisany = state?.ok && !state?.error;

  // Odpowiedź istnieje, jeśli była już w bazie (poczatkowa) ALBO właśnie
  // przeszedł udany zapis. Wtedy przycisk przełącza się z zielonego ✓
  // (zapisz) na żółty ołówek (edytuj) — analogicznie do KartaMeczu.jsx.
  const maOdpowiedz = !!poczatkowa || zapisany;

  // Dla dropdown_other potrzebujemy stanu czy user wybrał "Inny".
  // Migracja: starsze odpowiedzi mogły wskazywać DB-ową opcję "Inny"
  // (z czasów gdy UI renderowało dwa źródła) - traktujemy je jako "Inny"
  // i przepinamy na sentinel, żeby user mógł dopisać tekst.
  const [isOther, setIsOther] = useState(() => {
    if (poczatkowa?.answer_other_flag) return true;
    if (poczatkowa?.selected_option_id) {
      const wybrana = opcje.find((o) => o.id === poczatkowa.selected_option_id);
      if (wybrana?.opcja_text?.toUpperCase() === 'INNY') return true;
    }
    return false;
  });

  const [selectedId, setSelectedId] = useState(() => {
    if (poczatkowa?.answer_other_flag) return '';
    return poczatkowa?.selected_option_id?.toString() ?? '';
  });

  // Maks. punkty: dla pytań ważonych to max z punkty opcji.
  const maxPkt = (() => {
    if (
      pytanie.question_type === 'dropdown_weighted' ||
      pytanie.question_type === 'boolean_weighted' ||
      pytanie.question_type === 'dropdown_other'
    ) {
      const m = opcje.reduce((a, o) => (o.punkty > a ? o.punkty : a), 0);
      return m || pytanie.max_points;
    }
    return pytanie.max_points;
  })();

  return (
    <form
      action={action}
      className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 p-4"
    >
      <input type="hidden" name="questionId" value={pytanie.id} />

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-emerald-50">
          {pytanie.text}
        </h3>
        <span className="text-xs text-emerald-300/70">do {maxPkt} pkt</span>
      </div>

      {pytanie.description && (
        <p className="mb-3 text-sm text-emerald-200/70">{pytanie.description}</p>
      )}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <PoleOdpowiedzi
            pytanie={pytanie}
            poczatkowa={poczatkowa}
            teams={teams}
            opcje={opcje}
            isOther={isOther}
            setIsOther={setIsOther}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            disabled={!isOpen || pending}
          />
        </div>

        <div className="relative shrink-0">
          <button
            type="submit"
            disabled={!isOpen || pending}
            title={maOdpowiedz ? 'Zaktualizuj odpowiedź' : 'Zapisz odpowiedź'}
            aria-label={maOdpowiedz ? 'Zaktualizuj odpowiedź' : 'Zapisz odpowiedź'}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
              maOdpowiedz
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {pending ? (
              <IkonaSpinner />
            ) : maOdpowiedz ? (
              <IkonaPencil />
            ) : (
              <IkonaCheck />
            )}
          </button>
          {zapisany && (
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

      {state?.error && (
        <p className="mt-2 text-sm text-rose-300">{state.error}</p>
      )}
    </form>
  );
}

function PoleOdpowiedzi({
  pytanie,
  poczatkowa,
  teams,
  opcje,
  isOther,
  setIsOther,
  selectedId,
  setSelectedId,
  disabled,
}) {
  if (pytanie.question_type === 'team') {
    const dostepne = pytanie.team_group
      ? teams.filter((t) => t.group_in_tournament === pytanie.team_group)
      : teams;
    return (
      <select
        name="answerTeamId"
        defaultValue={poczatkowa?.answer_team_id ?? ''}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
      >
        <option value="">— wybierz drużynę —</option>
        {dostepne.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    );
  }

  if (pytanie.question_type === 'boolean') {
    const wartosc =
      poczatkowa?.answer_boolean === true
        ? 'true'
        : poczatkowa?.answer_boolean === false
          ? 'false'
          : '';
    return (
      <div className="flex h-10 flex-wrap items-center gap-4 text-sm text-emerald-100">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="answerBoolean"
            value="true"
            defaultChecked={wartosc === 'true'}
            disabled={disabled}
            className="h-4 w-4 accent-emerald-500"
          />
          Tak
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="answerBoolean"
            value="false"
            defaultChecked={wartosc === 'false'}
            disabled={disabled}
            className="h-4 w-4 accent-emerald-500"
          />
          Nie
        </label>
      </div>
    );
  }

  if (pytanie.question_type === 'number') {
    return (
      <input
        type="number"
        name="answerText"
        inputMode="numeric"
        defaultValue={poczatkowa?.answer_text ?? ''}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
      />
    );
  }

  if (pytanie.question_type === 'dropdown_weighted') {
    return (
      <select
        name="selectedOptionId"
        defaultValue={poczatkowa?.selected_option_id ?? ''}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
      >
        <option value="">— wybierz —</option>
        {opcje.map((o) => (
          <option key={o.id} value={o.id}>
            {o.opcja_text} ({o.punkty} pkt)
          </option>
        ))}
      </select>
    );
  }

  if (pytanie.question_type === 'boolean_weighted') {
    // Renderujemy jako 2 przyciski Tak/Nie. Opcje powinny się
    // nazywać "TAK" i "NIE" — szukamy ich po nazwie.
    const taj = opcje.find((o) => o.opcja_text?.toUpperCase() === 'TAK');
    const nie = opcje.find((o) => o.opcja_text?.toUpperCase() === 'NIE');
    const wybrane = poczatkowa?.selected_option_id ?? '';
    return (
      <div className="flex h-10 flex-wrap items-center gap-4 text-sm text-emerald-100">
        {taj && (
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="selectedOptionId"
              value={taj.id}
              defaultChecked={wybrane === taj.id}
              disabled={disabled}
              className="h-4 w-4 accent-emerald-500"
            />
            Tak <span className="text-emerald-300/70">({taj.punkty} pkt)</span>
          </label>
        )}
        {nie && (
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="selectedOptionId"
              value={nie.id}
              defaultChecked={wybrane === nie.id}
              disabled={disabled}
              className="h-4 w-4 accent-emerald-500"
            />
            Nie <span className="text-emerald-300/70">({nie.punkty} pkt)</span>
          </label>
        )}
      </div>
    );
  }

  if (pytanie.question_type === 'dropdown_other') {
    // Sentinel "__other__" jest jedynym źródłem opcji "Inny" — filtrujemy
    // ewentualną DB-ową opcję o nazwie "Inny" (kolejnosc=99), żeby nie
    // pojawiła się drugi raz. Z tego samego powodu poczatkowa wskazująca
    // na tę opcję jest powyżej traktowana jak isOther=true (migracja).
    const opcjeBezInny = opcje.filter(
      (o) => o.opcja_text?.toUpperCase() !== 'INNY',
    );
    return (
      <div className="space-y-2">
        <select
          value={isOther ? '__other__' : selectedId}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '__other__') {
              setIsOther(true);
              setSelectedId('');
            } else {
              setIsOther(false);
              setSelectedId(val);
            }
          }}
          name={isOther ? undefined : 'selectedOptionId'}
          disabled={disabled}
          className="h-10 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
        >
          <option value="">— wybierz —</option>
          {opcjeBezInny.map((o) => (
            <option key={o.id} value={o.id}>
              {o.opcja_text} ({o.punkty} pkt)
            </option>
          ))}
          <option value="__other__">Inny…</option>
        </select>
        <input type="hidden" name="isOther" value={isOther ? 'true' : 'false'} />
        {isOther && (
          // Neutralna (emerald) ramka — wcześniej amber wyglądał jak błąd
          // walidacji podczas pisania. Walidację pustego pola robi server
          // action i pokazuje komunikat pod formularzem.
          <input
            type="text"
            name="answerText"
            maxLength={200}
            placeholder="Wpisz własną odpowiedź"
            defaultValue={poczatkowa?.answer_other_flag ? (poczatkowa?.answer_text ?? '') : ''}
            disabled={disabled}
            className="h-10 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
          />
        )}
      </div>
    );
  }

  // 'text'
  return (
    <input
      type="text"
      name="answerText"
      maxLength={200}
      defaultValue={poczatkowa?.answer_text ?? ''}
      disabled={disabled}
      className="h-10 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
    />
  );
}

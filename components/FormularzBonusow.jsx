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

import { useActionState } from 'react';
import { zapiszOdpowiedzBonusowa } from '@/app/akcje/bonusy';

export default function FormularzBonusow({
  questions,
  userAnswers,
  teams,
  isOpen,
}) {
  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <PojedynczePytanie
          key={q.id}
          pytanie={q}
          poczatkowa={userAnswers?.[q.id]}
          teams={teams}
          isOpen={isOpen}
        />
      ))}
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

function PojedynczePytanie({ pytanie, poczatkowa, teams, isOpen }) {
  const [state, action, pending] = useActionState(zapiszOdpowiedzBonusowa, null);
  const zapisany = state?.ok && !state?.error;

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
        <span className="text-xs text-emerald-300/70">
          {pytanie.max_points} pkt
        </span>
      </div>

      {pytanie.description && (
        <p className="mb-3 text-sm text-emerald-200/70">{pytanie.description}</p>
      )}

      {/* Pole + przycisk w jednej linii. Pole bierze flex-1, przycisk
          shrink-0 z fixed w-10 h-10. Na mobile to też zostaje w linii -
          inputy są węższe niż całość. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <PoleOdpowiedzi
            pytanie={pytanie}
            poczatkowa={poczatkowa}
            teams={teams}
            disabled={!isOpen || pending}
          />
        </div>

        <div className="relative shrink-0">
          <button
            type="submit"
            disabled={!isOpen || pending}
            title="Zapisz odpowiedź"
            aria-label="Zapisz odpowiedź"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <IkonaSpinner /> : <IkonaCheck />}
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

function PoleOdpowiedzi({ pytanie, poczatkowa, teams, disabled }) {
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

'use client';

// Formularz pytań bonusowych - osobne pole + przycisk "Zapisz" per pytanie.
// Pojedynczy zapis zamiast jednego dużego submitu - user nie traci pracy
// jeśli wypełni połowę i zamknie kartę. Każdy wiersz to osobna instancja
// PojedyncePytanie (każdy ma swój własny useActionState).

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

function PojedynczePytanie({ pytanie, poczatkowa, teams, isOpen }) {
  const [state, action, pending] = useActionState(zapiszOdpowiedzBonusowa, null);

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

      <PoleOdpowiedzi
        pytanie={pytanie}
        poczatkowa={poczatkowa}
        teams={teams}
        disabled={!isOpen || pending}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isOpen || pending}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Zapisuję...' : 'Zapisz'}
        </button>
        {state?.ok && !pending && (
          <span className="text-sm font-semibold text-emerald-300">✓ Zapisano</span>
        )}
        {state?.error && (
          <span className="text-sm text-rose-300">{state.error}</span>
        )}
      </div>
    </form>
  );
}

function PoleOdpowiedzi({ pytanie, poczatkowa, teams, disabled }) {
  if (pytanie.question_type === 'team') {
    return (
      <select
        name="answerTeamId"
        defaultValue={poczatkowa?.answer_team_id ?? ''}
        disabled={disabled}
        className="w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
      >
        <option value="">— wybierz drużynę —</option>
        {teams.map((t) => (
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
      <div className="flex flex-wrap gap-4 text-sm text-emerald-100">
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
        className="w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
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
      className="w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-emerald-50 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
    />
  );
}

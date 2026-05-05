'use client';

// Wspólny formularz pytania bonusowego - dla /admin/bonusy/nowe i /admin/bonusy/[id]/edycja.

import { useActionState, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import SelectTypPytania from '@/components/SelectTypPytania';

// MŚ 2026 — 48 drużyn w 12 grupach (A–L), nie 8 jak w starszych edycjach.
const GRUPY_MS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function FormularzPytania({
  akcja,
  defaultValues = {},
  ostrzezenie,
}) {
  const [stan, action, pending] = useActionState(akcja, null);
  const [questionType, setQuestionType] = useState(
    defaultValues.question_type ?? 'team',
  );

  return (
    <form action={action} className="space-y-5">
      {ostrzezenie && (
        <p className="rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {ostrzezenie}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-emerald-100">
          Treść pytania
        </span>
        <input
          name="text"
          defaultValue={defaultValues.text ?? ''}
          required
          minLength={3}
          maxLength={500}
          placeholder="np. Kto zostanie mistrzem?"
          className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-emerald-100">
          Opis (opcjonalny)
        </span>
        <textarea
          name="description"
          defaultValue={defaultValues.description ?? ''}
          rows={2}
          maxLength={1000}
          placeholder="np. liczy się imię i nazwisko, bramki samobójcze nie liczą się"
          className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      <div>
        <span className="mb-2 block text-sm font-medium text-emerald-100">
          Typ odpowiedzi
        </span>
        <SelectTypPytania value={questionType} onChange={setQuestionType} />
      </div>

      {questionType === 'team' && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-emerald-100">
            Filtruj drużyny po grupie (opcjonalnie)
          </span>
          <select
            name="team_group"
            defaultValue={defaultValues.team_group ?? ''}
            className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          >
            <option value="">Wszystkie drużyny</option>
            {GRUPY_MS.map((litera) => (
              <option key={litera} value={`GROUP_${litera}`}>
                Grupa {litera}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-emerald-200/60">
            Po wybraniu grupy w dropdownie odpowiedzi pojawią się tylko drużyny z tej grupy.
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Pole
          label="Punkty za poprawną"
          name="max_points"
          type="number"
          defaultValue={defaultValues.max_points ?? 5}
          required
          min={1}
          max={1000}
        />
        <Pole
          label="Kolejność"
          name="order_index"
          type="number"
          defaultValue={defaultValues.order_index ?? 0}
          required
          min={0}
        />
      </div>

      {stan?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {stan.error}
        </p>
      )}
      {stan?.ok && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          {stan.ok}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisuję…' : 'Zapisz pytanie'}
        </Button>
        <Link href="/admin/bonusy" className="text-sm text-emerald-300 hover:text-emerald-200">
          Anuluj
        </Link>
      </div>
    </form>
  );
}

function Pole({ label, name, type = 'text', defaultValue, required, min, max }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

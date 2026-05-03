'use client';

// Formularz ustawień turnieju. Daty w datetime-local (czas polski).

import { useActionState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';

export default function FormularzUstawien({ akcja, defaultValues = {} }) {
  const [stan, action, pending] = useActionState(akcja, null);

  return (
    <form action={action} className="space-y-4">
      <Pole
        label="Nazwa turnieju"
        name="tournament_name"
        defaultValue={defaultValues.tournament_name ?? ''}
        required
        minLength={2}
        maxLength={100}
        placeholder="np. Mistrzostwa Świata 2026"
      />
      <Pole
        label="Bonusy zamykają się (czas polski)"
        name="bonuses_close_at"
        type="datetime-local"
        defaultValue={defaultValues.bonuses_close_at ?? ''}
        required
      />
      <Pole
        label="Turniej startuje (czas polski)"
        name="tournament_starts_at"
        type="datetime-local"
        defaultValue={defaultValues.tournament_starts_at ?? ''}
        required
      />

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
          {pending ? 'Zapisuję…' : 'Zapisz ustawienia'}
        </Button>
        <Link href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">
          Wróć
        </Link>
      </div>
    </form>
  );
}

function Pole({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  minLength,
  maxLength,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

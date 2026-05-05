'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { wygenerujKod } from '@/app/akcje/zaproszenia';
import Button from '@/components/Button';

export default function FormularzKodu() {
  const [stan, akcja, pending] = useActionState(wygenerujKod, null);

  return (
    <form action={akcja} className="space-y-4">
      <Pole
        label="Opis kodu"
        name="description"
        placeholder='np. "dla Adama" albo "MŚ 2026"'
        required
        maxLength={100}
      />

      <Pole
        label="Liczba użyć"
        name="maxUses"
        type="number"
        defaultValue={1}
        min={1}
        max={1000}
        required
      />

      <Pole
        label="Wygasa (opcjonalnie)"
        name="expiresAt"
        type="datetime-local"
        placeholder=""
      />

      {stan?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {stan.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Generuję…' : 'Wygeneruj kod'}
        </Button>
        <Link
          href="/admin/zaproszenia"
          className="text-sm text-emerald-300 hover:text-emerald-200"
        >
          Anuluj
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
  min,
  max,
  maxLength,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

'use client';

// Wspólny formularz drużyny - używany przez /admin/druzyny/nowa
// i /admin/druzyny/[id]/edycja. Akcję dostaje z propa (dodajDruzyne
// albo edytujDruzyne.bind(null, id)).

import { useActionState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';

export default function FormularzDruzyny({ akcja, defaultValues = {} }) {
  const [stan, action, pending] = useActionState(akcja, null);

  return (
    <form action={action} className="space-y-4">
      <Pole
        label="Nazwa drużyny"
        name="name"
        defaultValue={defaultValues.name ?? ''}
        required
        minLength={2}
        maxLength={50}
        placeholder="np. Polska"
      />

      {stan?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {stan.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisuję…' : 'Zapisz'}
        </Button>
        <Link href="/admin/druzyny" className="text-sm text-emerald-300 hover:text-emerald-200">
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
        defaultValue={defaultValue}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

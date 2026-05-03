'use client';

// Formularz ustawienia nowego hasła. Trafia tu user po kliknięciu
// w link z maila (Route Handler /auth/reset wymienił code na sesję).
// Server Action ustawNoweHaslo wywołuje supabase.auth.updateUser({ password }).

import Link from 'next/link';
import { useActionState } from 'react';
import { ustawNoweHaslo } from '@/app/akcje/auth';
import Button from '@/components/Button';

export default function NoweHasloPage() {
  const [stan, akcja, pending] = useActionState(ustawNoweHaslo, null);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/30 p-8 shadow-xl backdrop-blur">
        <h1 className="mb-2 text-2xl font-bold text-emerald-50">
          Ustaw nowe hasło
        </h1>
        <p className="mb-6 text-sm text-emerald-200/70">
          Podaj nowe hasło i powtórz je dla pewności.
        </p>

        <form action={akcja} className="space-y-4">
          <Pole
            label="Nowe hasło"
            name="password"
            type="password"
            placeholder="min. 6 znaków"
          />
          <Pole
            label="Powtórz hasło"
            name="confirm"
            type="password"
            placeholder="powtórz nowe hasło"
          />

          {stan?.error && (
            <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              {stan.error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Zapisuję…' : 'Zapisz nowe hasło'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-emerald-200/70">
          <Link
            href="/profil"
            className="font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Anuluj
          </Link>
        </p>
      </div>
    </main>
  );
}

function Pole({ label, name, type, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        minLength={6}
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

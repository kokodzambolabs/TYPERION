'use client';

// Formularz rejestracji. Używamy useActionState żeby Server Action mógł
// zwrócić błąd walidacji albo Supabase, a my pokażemy go pod formularzem.

import Link from 'next/link';
import { useActionState } from 'react';
import { zarejestruj } from '@/app/akcje/auth';
import Button from '@/components/Button';

export default function RejestracjaPage() {
  const [stan, akcja, pending] = useActionState(zarejestruj, null);

  return (
    <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/30 p-8 shadow-xl backdrop-blur">
      <h1 className="mb-2 text-2xl font-bold text-emerald-50">Załóż konto</h1>
      <p className="mb-6 text-sm text-emerald-200/70">
        Po rejestracji wyślemy Ci link aktywacyjny na podany email.
      </p>

      <form action={akcja} className="space-y-4">
        <Pole label="E-mail" name="email" type="email" placeholder="ty@przyklad.pl" />
        <Pole label="Hasło" name="password" type="password" placeholder="min. 6 znaków" />
        <Pole label="Nick" name="nick" type="text" placeholder="3-20 znaków, bez spacji" />

        {stan?.error && (
          <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {stan.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Zakładam konto…' : 'Zarejestruj się'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-emerald-200/70">
        Masz już konto?{' '}
        <Link href="/logowanie" className="font-semibold text-emerald-300 hover:text-emerald-200">
          Zaloguj się
        </Link>
      </p>
    </div>
  );
}

function Pole({ label, name, type, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

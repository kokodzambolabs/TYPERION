'use client';

// Formularz "Zapomniałem hasła". Wpisujemy e-mail, Server Action wysyła
// link resetujący przez Supabase. Po sukcesie pokazujemy komunikat zamiast
// formularza - link niezależnie od tego, czy e-mail istnieje w bazie.

import Link from 'next/link';
import { useActionState } from 'react';
import { wyslijLinkResetuHasla } from '@/app/akcje/auth';
import Button from '@/components/Button';

export default function ZapomnialemHaslaPage() {
  const [stan, akcja, pending] = useActionState(wyslijLinkResetuHasla, null);

  return (
    <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/30 p-8 shadow-xl backdrop-blur">
      <h1 className="mb-2 text-2xl font-bold text-emerald-50">
        Zapomniałeś hasła?
      </h1>
      <p className="mb-6 text-sm text-emerald-200/70">
        Podaj e-mail przypisany do konta. Wyślemy link do ustawienia nowego hasła.
      </p>

      {stan?.ok ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          ✉️ {stan.ok}
        </div>
      ) : (
        <form action={akcja} className="space-y-4">
          <Pole
            label="E-mail"
            name="email"
            type="email"
            placeholder="ty@przyklad.pl"
          />

          {stan?.error && (
            <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              {stan.error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Wysyłam…' : 'Wyślij link do resetu'}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-emerald-200/70">
        <Link
          href="/logowanie"
          className="font-semibold text-emerald-300 hover:text-emerald-200"
        >
          ← Powrót do logowania
        </Link>
      </p>
    </div>
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
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

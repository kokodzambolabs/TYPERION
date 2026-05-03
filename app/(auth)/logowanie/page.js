'use client';

// Formularz logowania. Komponent czytający ?error=... wydzielony do
// LogowanieFormularz, owinięty w Suspense - useSearchParams w Next.js 16
// wymaga granicy Suspense, inaczej build prerenderowy odpada.

import Link from 'next/link';
import { Suspense } from 'react';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { zaloguj } from '@/app/akcje/auth';
import Button from '@/components/Button';

export default function LogowaniePage() {
  return (
    <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/30 p-8 shadow-xl backdrop-blur">
      <h1 className="mb-2 text-2xl font-bold text-emerald-50">Zaloguj się</h1>
      <p className="mb-6 text-sm text-emerald-200/70">
        Wpisz e-mail i hasło żeby wrócić do typowania.
      </p>

      <Suspense fallback={<LogowanieFormularz bladUrl={null} />}>
        <LogowanieFormularzZParamem />
      </Suspense>

      <p className="mt-4 text-center text-sm">
        <Link
          href="/zapomnialem-hasla"
          className="text-emerald-300/80 hover:text-emerald-200"
        >
          Zapomniałeś hasła?
        </Link>
      </p>

      <p className="mt-6 text-center text-sm text-emerald-200/70">
        Nie masz konta?{' '}
        <Link href="/rejestracja" className="font-semibold text-emerald-300 hover:text-emerald-200">
          Zarejestruj się
        </Link>
      </p>
    </div>
  );
}

function LogowanieFormularzZParamem() {
  const params = useSearchParams();
  const bladUrl =
    params.get('error') === 'invalid_link'
      ? 'Link jest nieprawidłowy lub wygasł. Spróbuj ponownie.'
      : null;
  return <LogowanieFormularz bladUrl={bladUrl} />;
}

function LogowanieFormularz({ bladUrl }) {
  const [stan, akcja, pending] = useActionState(zaloguj, null);

  return (
    <form action={akcja} className="space-y-4">
      <Pole label="E-mail" name="email" type="email" placeholder="ty@przyklad.pl" />
      <Pole label="Hasło" name="password" type="password" placeholder="••••••" />

      {(stan?.error || bladUrl) && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {stan?.error || bladUrl}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Loguję…' : 'Zaloguj się'}
      </Button>
    </form>
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

'use client';

// Formularz "Wyślij link ponownie" - wywołuje Server Action
// wyslijLinkPonownie. Email domyślnie wstępnie wypełniony tym z URL.

import { useActionState } from 'react';
import { wyslijLinkPonownie } from '@/app/akcje/auth';
import Button from '@/components/Button';

export default function FormularzPonownegoLinku({ email }) {
  const [stan, akcja, pending] = useActionState(wyslijLinkPonownie, null);

  return (
    <form action={akcja} className="space-y-3">
      <label className="block">
        <span className="sr-only">E-mail</span>
        <input
          name="email"
          type="email"
          defaultValue={email}
          placeholder="ty@przyklad.pl"
          required
          className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

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

      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="w-full"
      >
        {pending ? 'Wysyłam…' : 'Wyślij ponownie'}
      </Button>
    </form>
  );
}

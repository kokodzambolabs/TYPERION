'use client';

// Modal wyświetlany po pierwszym zalogowaniu, dopóki user nie zaakceptuje
// regulaminu. Brak X / Odrzuć - jedyna droga dalej to "Akceptuj".
// Server Action zaakceptujRegulamin() aktualizuje profiles i revaliduje
// layout, więc przy następnym renderze modal zniknie.

import { useTransition } from 'react';
import { zaakceptujRegulamin } from '@/app/akcje/auth';

export default function ModalRegulaminu() {
  const [pending, startTransition] = useTransition();

  function obsluzAkceptacje() {
    startTransition(async () => {
      await zaakceptujRegulamin();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tytul-regulaminu"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur"
    >
      <div className="w-full max-w-lg rounded-2xl border border-emerald-700/60 bg-emerald-950 p-8 shadow-2xl">
        <h2
          id="tytul-regulaminu"
          className="mb-6 text-center text-3xl font-bold text-emerald-50"
        >
          Regulamin
        </h2>

        <div className="my-12 text-center">
          <p className="text-2xl font-semibold leading-relaxed text-emerald-100">
            1. Administrator ma zawsze racej i Pawel z adwokatem Norkiem japa cicho
          </p>
        </div>

        <button
          type="button"
          onClick={obsluzAkceptacje}
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-5 py-3 text-base font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Zapisuję…' : 'Akceptuj'}
        </button>
      </div>
    </div>
  );
}

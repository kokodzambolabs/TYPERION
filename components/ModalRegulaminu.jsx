'use client';

// Modal wyświetlany po pierwszym zalogowaniu, dopóki user nie zaakceptuje
// regulaminu. Brak X / Odrzuć - jedyna droga dalej to "Akceptuj".
// Server Action zaakceptujRegulamin() aktualizuje profiles i revaliduje
// layout, więc przy następnym renderze modal zniknie.
// Treść regulaminu siedzi w <TrescRegulaminu /> - tym samym komponencie,
// którego używa podstrona /faq.

import { useTransition } from 'react';
import { zaakceptujRegulamin } from '@/app/akcje/auth';
import TrescRegulaminu from '@/components/TrescRegulaminu';

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
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl border border-emerald-700/60 bg-emerald-950 shadow-2xl">
        <div className="border-b border-emerald-800/60 px-6 py-5 sm:px-8">
          <h2
            id="tytul-regulaminu"
            className="text-center text-2xl font-bold text-emerald-50 sm:text-3xl"
          >
            Regulamin Typerion
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <TrescRegulaminu />
        </div>

        <div className="border-t border-emerald-800/60 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={obsluzAkceptacje}
            disabled={pending}
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-5 py-3 text-base font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Zapisuję…' : 'Akceptuję regulamin'}
          </button>
        </div>
      </div>
    </div>
  );
}

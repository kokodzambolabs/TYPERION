'use client';

// Dropdown z nickiem usera: Mój profil, Reset hasła, Wyloguj.
// Klik poza menu zamyka je. Reset hasła wywołuje Server Action
// i pokazuje toast z zamaskowanym emailem na 5 sekund.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  wyloguj,
  wyslijLinkResetuHaslaDlaZalogowanego,
} from '@/app/akcje/auth';

export default function MenuProfilowe({ nick }) {
  const [otwarte, setOtwarte] = useState(false);
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!otwarte) return;
    function naKlik(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOtwarte(false);
      }
    }
    document.addEventListener('mousedown', naKlik);
    return () => document.removeEventListener('mousedown', naKlik);
  }, [otwarte]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function obsluzReset() {
    setOtwarte(false);
    startTransition(async () => {
      const wynik = await wyslijLinkResetuHaslaDlaZalogowanego();
      if (wynik?.ok) {
        setToast({
          typ: 'ok',
          tresc: `✓ Wysłaliśmy link do resetu hasła na email: ${wynik.email}`,
        });
      } else {
        setToast({
          typ: 'blad',
          tresc: wynik?.error || 'Nie udało się wysłać linku.',
        });
      }
    });
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOtwarte((p) => !p)}
          aria-haspopup="menu"
          aria-expanded={otwarte}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-900/40 px-3 py-1.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span aria-hidden>👤</span>
          <span className="max-w-[10rem] truncate">{nick || 'Konto'}</span>
          <span aria-hidden className="text-xs">▾</span>
        </button>

        {otwarte && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-emerald-800/60 bg-emerald-900 shadow-xl"
          >
            <Link
              href="/profil"
              role="menuitem"
              onClick={() => setOtwarte(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-100 transition hover:bg-emerald-800"
            >
              <span aria-hidden>👤</span>
              Mój profil
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={obsluzReset}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-emerald-100 transition hover:bg-emerald-800 disabled:opacity-60"
            >
              <span aria-hidden>🔑</span>
              {pending ? 'Wysyłam…' : 'Reset hasła'}
            </button>
            {/* NIE zamykaj menu w onClick - setOtwarte(false) unmountuje
                <form>, zanim React zdąży odpalić Server Action wyloguj().
                Po signOut() w akcji następuje redirect('/'), więc menu
                znika razem z całą stroną. */}
            <form action={wyloguj}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 border-t border-emerald-800/60 px-4 py-2.5 text-left text-sm text-emerald-100 transition hover:bg-emerald-800"
              >
                <span aria-hidden>🚪</span>
                Wyloguj
              </button>
            </form>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur ${
            toast.typ === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
              : 'border-red-500/40 bg-red-950/90 text-red-100'
          }`}
        >
          {toast.tresc}
        </div>
      )}
    </>
  );
}

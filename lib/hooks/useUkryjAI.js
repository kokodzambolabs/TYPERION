'use client';

// Globalny stan filtra "Ukryj AI" - dzielony między /ranking i panele
// cudzych typów (KartaMeczu). Trzymamy go w localStorage, żeby zaznaczenie
// na /ranking propagowało się na inne strony bez Context Providera.
//
// Listener: oprócz natywnego eventu 'storage' (działa tylko cross-tab w przeglądarce)
// dispatchujemy własny event 'typerion:ukryjAI', żeby komponenty na TEJ SAMEJ
// stronie też dostały update natychmiast po zmianie checkboxa.
//
// `zainicjalizowany` pozwala konsumentom rozpoznać moment "przed odczytem
// z localStorage" (SSR / pierwszy render klienta) - można pokazać szkielet
// zamiast migać między pełną a przefiltrowaną listą.

import { useState, useEffect } from 'react';

const KLUCZ_STORAGE = 'typerion_ukryj_ai';
const EVENT_NAME = 'typerion:ukryjAI';

export function useUkryjAI() {
  const [ukryjAI, setUkryjAIState] = useState(false);
  const [zainicjalizowany, setZainicjalizowany] = useState(false);

  useEffect(() => {
    try {
      const zapisane = window.localStorage.getItem(KLUCZ_STORAGE);
      setUkryjAIState(zapisane === 'true');
    } catch {
      // localStorage może być niedostępny (private mode itp.) - olej.
    }
    setZainicjalizowany(true);

    const handler = (e) => {
      // Native 'storage' event ma e.key i e.newValue; nasz custom event nie.
      if (e?.key && e.key !== KLUCZ_STORAGE) return;
      try {
        const zapisane = window.localStorage.getItem(KLUCZ_STORAGE);
        setUkryjAIState(zapisane === 'true');
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(EVENT_NAME, handler);
    };
  }, []);

  const setUkryjAI = (value) => {
    const v = !!value;
    setUkryjAIState(v);
    try {
      window.localStorage.setItem(KLUCZ_STORAGE, v ? 'true' : 'false');
    } catch {
      // ignore
    }
    // Custom event - dla komponentów na tej samej stronie. Natywny 'storage'
    // event NIE odpala się w karcie, która sama wykonała setItem.
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  return { ukryjAI, setUkryjAI, zainicjalizowany };
}

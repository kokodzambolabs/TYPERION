'use client';

// Tabela opcji pytania ważonego: dodawanie, edycja punktów inline,
// usuwanie, oznaczanie poprawnej. Każdy wiersz to osobny `useTransition`,
// żeby zapis punktów jednej opcji nie blokował reszty.

import { useState, useTransition } from 'react';
import {
  dodajOpcje,
  edytujOpcje,
  zapiszPunktyOpcji,
  usunOpcje,
  oznaczOpcjePoprawna,
} from '@/app/akcje/bonusy';

export default function EdytorOpcji({ pytanieId, opcje, questionType }) {
  // dropdown_other wymaga "Inny" jako osobnej opcji rozliczanej ręcznie -
  // ale tę rolę pełni flaga answer_other_flag na odpowiedzi usera, NIE
  // wpisujemy "Inny" jako rekord w bonus_question_options. Admin nie musi
  // jej dodawać - UI usera renderuje ją zawsze.

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-emerald-100">
        Opcje odpowiedzi {pomoc(questionType)}
      </h2>

      {opcje.length === 0 ? (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Brak opcji. Dodaj poniżej.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {opcje.map((o) => (
            <li key={o.id}>
              <WierszOpcji opcja={o} pytanieId={pytanieId} />
            </li>
          ))}
        </ul>
      )}

      <FormularzNowejOpcji pytanieId={pytanieId} />
    </section>
  );
}

function pomoc(typ) {
  if (typ === 'boolean_weighted') {
    return (
      <span className="ml-2 text-xs font-normal text-emerald-200/70">
        — dodaj dwa wiersze: „TAK” i „NIE” (różne punkty).
      </span>
    );
  }
  if (typ === 'dropdown_other') {
    return (
      <span className="ml-2 text-xs font-normal text-emerald-200/70">
        — opcja „Inny” renderuje się automatycznie i jest rozliczana ręcznie.
      </span>
    );
  }
  return null;
}

function WierszOpcji({ opcja, pytanieId }) {
  const [tekst, setTekst] = useState(opcja.opcja_text);
  const [punkty, setPunkty] = useState(opcja.punkty);
  const [kolejnosc, setKolejnosc] = useState(opcja.kolejnosc);
  const [zapisywanie, startZapisu] = useTransition();
  const [komunikat, setKomunikat] = useState(null);

  const akcjaEdytuj = edytujOpcje.bind(null, opcja.id);

  // Inline zapis SAMYCH punktów (bez tekstu/kolejności) - najczęściej używane
  // przy korygowaniu wag przed turniejem.
  const zapiszSamePunkty = () => {
    setKomunikat(null);
    startZapisu(async () => {
      const res = await zapiszPunktyOpcji(opcja.id, Number(punkty));
      if (res?.error) setKomunikat({ error: res.error });
      else setKomunikat({ ok: 'Zapisano punkty.' });
    });
  };

  const oznaczPoprawna = () => {
    setKomunikat(null);
    startZapisu(async () => {
      const res = await oznaczOpcjePoprawna(opcja.id);
      if (res?.error) setKomunikat({ error: res.error });
      else setKomunikat({ ok: 'Oznaczono.' });
    });
  };

  const usun = () => {
    if (!confirm(`Usunąć opcję „${opcja.opcja_text}”?`)) return;
    setKomunikat(null);
    startZapisu(async () => {
      const res = await usunOpcje(opcja.id);
      if (res?.error) setKomunikat({ error: res.error });
    });
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        opcja.is_correct
          ? 'border-emerald-400/60 bg-emerald-500/10'
          : 'border-emerald-900/40 bg-emerald-950/30'
      }`}
    >
      <form
        action={akcjaEdytuj}
        className="grid grid-cols-[1fr_5rem_4rem_auto] items-end gap-2"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-emerald-200/70">Tekst</span>
          <input
            name="opcja_text"
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            className="h-9 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-2 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-emerald-200/70">Punkty</span>
          <input
            name="punkty"
            type="number"
            min={0}
            max={1000}
            value={punkty}
            onChange={(e) => setPunkty(e.target.value)}
            className="h-9 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-2 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-emerald-200/70">Kol.</span>
          <input
            name="kolejnosc"
            type="number"
            min={0}
            value={kolejnosc}
            onChange={(e) => setKolejnosc(e.target.value)}
            className="h-9 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-2 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
            required
          />
        </label>
        <button
          type="submit"
          disabled={zapisywanie}
          className="h-9 rounded-md border border-emerald-500/50 bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
        >
          Zapisz
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={zapiszSamePunkty}
          disabled={zapisywanie}
          className="rounded-md border border-emerald-700/60 bg-emerald-900/30 px-2 py-1 text-xs text-emerald-100 transition hover:border-emerald-500/60 disabled:opacity-50"
          title="Zapisz wyłącznie punkty (szybka korekta wag)"
        >
          Tylko punkty
        </button>
        <button
          type="button"
          onClick={oznaczPoprawna}
          disabled={zapisywanie || opcja.is_correct}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
          title="Oznacz jako poprawną odpowiedź"
        >
          {opcja.is_correct ? '✓ Poprawna' : 'Oznacz poprawną'}
        </button>
        <button
          type="button"
          onClick={usun}
          disabled={zapisywanie}
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          Usuń
        </button>
      </div>

      {komunikat?.error && (
        <p className="mt-2 text-xs text-rose-300">{komunikat.error}</p>
      )}
      {komunikat?.ok && (
        <p className="mt-2 text-xs text-emerald-300">{komunikat.ok}</p>
      )}
    </div>
  );
}

function FormularzNowejOpcji({ pytanieId }) {
  const akcja = dodajOpcje.bind(null, pytanieId);

  return (
    <form
      action={akcja}
      className="grid grid-cols-[1fr_5rem_4rem_auto] items-end gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs text-emerald-200/70">
          Nowa opcja — tekst
        </span>
        <input
          name="opcja_text"
          placeholder="np. Hiszpania / TAK / NIE"
          required
          className="h-9 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-2 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-emerald-200/70">Punkty</span>
        <input
          name="punkty"
          type="number"
          min={0}
          max={1000}
          defaultValue={0}
          required
          className="h-9 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-2 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-emerald-200/70">Kol.</span>
        <input
          name="kolejnosc"
          type="number"
          min={0}
          defaultValue={0}
          required
          className="h-9 w-full rounded-md border border-emerald-700/60 bg-emerald-950/60 px-2 text-sm text-emerald-50 focus:border-emerald-400 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="h-9 rounded-md border border-emerald-500/50 bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
      >
        + Dodaj
      </button>
    </form>
  );
}

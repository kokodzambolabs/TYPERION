'use client';

// Panel generowania typów AI:
//   - filtry (kompetycja, data od-do, fraza),
//   - lista nadchodzących meczów z checkboxami,
//   - przycisk "Wygeneruj typy dla zaznaczonych" → wygenerujTypyMasowo,
//   - komunikat o zleceniu zadań w tle (fire-and-forget).
//
// useTransition trzyma "pending" - akcja wraca w <1s (tylko zleca zadania),
// więc spinner i tak nie zdąży się pojawić. Wynik to liczba zleconych zadań -
// faktyczne typy widać w /admin/boty-ai/logi po 2-3 min.

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { wygenerujTypyMasowo } from '@/app/akcje/ai-boty';
import { formatujDateKrotkoPL, formatGrupa } from '@/lib/format';

export default function PanelGenerowania({
  mecze,
  boty,
  kompetycje,
  nazwyKompetycji,
}) {
  const [filtrKompetycja, setFiltrKompetycja] = useState('');
  const [filtrFraza, setFiltrFraza] = useState('');
  const [dataOd, setDataOd] = useState('');
  const [dataDo, setDataDo] = useState('');
  const [zaznaczone, setZaznaczone] = useState(new Set());
  const [pending, start] = useTransition();
  const [wynik, setWynik] = useState(null);

  const widoczne = useMemo(() => {
    return mecze.filter((m) => {
      if (filtrKompetycja && m.competition_code !== filtrKompetycja) return false;
      if (filtrFraza) {
        const f = filtrFraza.toLowerCase();
        const tekst = `${m.home} ${m.away}`.toLowerCase();
        if (!tekst.includes(f)) return false;
      }
      const ts = new Date(m.kickoff_at).getTime();
      if (dataOd && ts < new Date(dataOd).getTime()) return false;
      if (dataDo && ts > new Date(dataDo + 'T23:59:59').getTime()) return false;
      return true;
    });
  }, [mecze, filtrKompetycja, filtrFraza, dataOd, dataDo]);

  const toggle = (id) => {
    setZaznaczone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const zaznaczWszystkie = () => {
    const ids = widoczne.map((m) => m.id);
    setZaznaczone(new Set(ids));
  };
  const odznaczWszystkie = () => setZaznaczone(new Set());

  const onGeneruj = () => {
    if (zaznaczone.size === 0) return;
    setWynik(null);
    start(async () => {
      const r = await wygenerujTypyMasowo(Array.from(zaznaczone));
      setWynik(r);
    });
  };

  const liczbaBotow = boty.length;
  const liczbaWywolan = zaznaczone.size * liczbaBotow;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
        <h2 className="mb-3 text-lg font-bold text-emerald-50">Filtry</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-emerald-200/80">Kompetycja</span>
            <select
              value={filtrKompetycja}
              onChange={(e) => setFiltrKompetycja(e.target.value)}
              disabled={pending}
              className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-2 text-emerald-50 outline-none focus:border-emerald-400 disabled:opacity-50"
            >
              <option value="">Wszystkie</option>
              {kompetycje.map((k) => (
                <option key={k} value={k}>
                  {k} — {nazwyKompetycji[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-emerald-200/80">Data od</span>
            <input
              type="date"
              value={dataOd}
              onChange={(e) => setDataOd(e.target.value)}
              disabled={pending}
              className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-2 text-emerald-50 outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-emerald-200/80">Data do</span>
            <input
              type="date"
              value={dataDo}
              onChange={(e) => setDataDo(e.target.value)}
              disabled={pending}
              className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-2 text-emerald-50 outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-emerald-200/80">Drużyna</span>
            <input
              type="text"
              value={filtrFraza}
              onChange={(e) => setFiltrFraza(e.target.value)}
              placeholder="np. Polska"
              disabled={pending}
              className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-emerald-50">
            Mecze ({widoczne.length})
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={zaznaczWszystkie}
              disabled={pending}
              className="rounded-md border border-emerald-700/60 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              Zaznacz widoczne
            </button>
            <button
              type="button"
              onClick={odznaczWszystkie}
              disabled={pending}
              className="rounded-md border border-emerald-700/60 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              Odznacz
            </button>
          </div>
        </div>

        {widoczne.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200/60">
            Brak meczów spełniających filtry.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {widoczne.map((m) => {
              const grupa = formatGrupa(m.group_name);
              const checked = zaznaczone.has(m.id);
              const wszystkieBoty =
                liczbaBotow > 0 && m.botyKtorzyTypowali >= liczbaBotow;
              return (
                <li
                  key={m.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm ${
                    checked
                      ? 'border-emerald-500/60 bg-emerald-900/40'
                      : 'border-emerald-900/40 bg-emerald-950/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(m.id)}
                    disabled={pending}
                    className="h-4 w-4 cursor-pointer rounded border-emerald-700/60 bg-emerald-950/50 text-emerald-500"
                  />
                  <span className="shrink-0 text-xs text-emerald-200/70">
                    {formatujDateKrotkoPL(m.kickoff_at)}
                  </span>
                  {m.competition_code && (
                    <span className="shrink-0 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                      {m.competition_code}
                    </span>
                  )}
                  {grupa && (
                    <span className="shrink-0 rounded bg-emerald-700/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                      {grupa}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-emerald-50">
                    {m.home} vs {m.away}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      wszystkieBoty
                        ? 'bg-emerald-700/60 text-emerald-100'
                        : m.botyKtorzyTypowali > 0
                          ? 'bg-amber-900/40 text-amber-100'
                          : 'bg-emerald-950/60 text-emerald-300/60'
                    }`}
                    title="Ile botów już typowało"
                  >
                    🤖 {m.botyKtorzyTypowali}/{liczbaBotow}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-900/40 pt-3">
          <div className="text-sm text-emerald-200/80">
            Zaznaczone:{' '}
            <strong className="font-mono text-emerald-50">
              {zaznaczone.size}
            </strong>{' '}
            meczów × {liczbaBotow} botów ={' '}
            <strong className="font-mono text-emerald-50">
              {liczbaWywolan}
            </strong>{' '}
            wywołań AI
          </div>
          <Button
            onClick={onGeneruj}
            disabled={pending || zaznaczone.size === 0 || liczbaBotow === 0}
          >
            {pending
              ? 'Generuję…'
              : `⚡ Wygeneruj typy (${liczbaWywolan})`}
          </Button>
        </div>

        {pending && (
          <p className="mt-3 rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
            ⏳ Zlecam zadania…
          </p>
        )}

        {liczbaBotow === 0 && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            ⚠️ Nie masz jeszcze żadnego bota.{' '}
            <Link
              href="/admin/boty-ai"
              className="font-semibold underline hover:text-amber-50"
            >
              Utwórz boty AI
            </Link>
            .
          </p>
        )}
      </section>

      {wynik && <PodsumowanieGenerowania wynik={wynik} />}
    </div>
  );
}

function PodsumowanieGenerowania({ wynik }) {
  if (wynik.error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
        ❌ {wynik.error}
      </div>
    );
  }
  // Po refactorze na fire-and-forget Server Action wraca natychmiast z
  // liczbą zleconych zadań, a nie faktycznymi typami. Wyniki ląduja
  // w /admin/boty-ai/logi w miarę kończenia pracy botów.
  return (
    <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
      <h2 className="mb-3 text-lg font-bold text-emerald-50">
        ✅ Zadania zlecone
      </h2>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Stat label="Zlecone zadania" value={wynik.zlecone ?? 0} kolor="emerald" />
        <Stat label="Aktywne boty" value={wynik.botow ?? 0} kolor="emerald" />
        <Stat label="Mecze" value={wynik.meczow ?? 0} kolor="emerald" />
      </div>
      <p className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
        🤖 {wynik.info || `Zlecono ${wynik.zlecone} zadań typowania.`}
        <br />
        Każdy bot pracuje w tle (do ~5 min na typ). Odśwież{' '}
        <Link
          href="/admin/boty-ai/logi"
          className="font-semibold underline hover:text-sky-50"
        >
          listę logów
        </Link>{' '}
        za 2-3 minuty, żeby zobaczyć wyniki.
      </p>
    </section>
  );
}

function Stat({ label, value, kolor }) {
  const klasy = {
    emerald: 'border-emerald-700/40 bg-emerald-950/40 text-emerald-100',
    red: 'border-rose-700/40 bg-rose-950/30 text-rose-100',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${klasy[kolor] || klasy.emerald}`}>
      <div className="text-xs uppercase tracking-wide text-emerald-200/60">
        {label}
      </div>
      <div className="font-mono text-lg font-bold">{value}</div>
    </div>
  );
}

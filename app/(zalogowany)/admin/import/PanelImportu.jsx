'use client';

// Panel importu - wybór rozgrywek + dwa kroki:
//   1) "📥 Importuj drużyny" - pobiera listę zespołów z /competitions/{code}/teams
//      i wkłada do bazy te, których jeszcze nie ma (po external_id),
//      a do drużyn istniejących po nazwie dopisuje external_id.
//   2) "📥 Importuj mecze" - pobiera /competitions/{code}/matches i wkłada
//      do bazy te, które nie istnieją po external_id (drużyny muszą być
//      już zmapowane).
//
// Stan trzymamy lokalnie (useState + useTransition). Każdy z kroków ma
// własny pending i własny wynik wyświetlany pod sekcją.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { importujMecze, importujDruzyny } from '@/app/akcje/import';
import { DOZWOLONE_COMPETITIONS, NAZWY_COMPETITIONS } from '@/lib/competitions';

export default function PanelImportu({
  meczeCount,
  druzynyCount,
  druzynyZmapowane,
}) {
  const [competition, setCompetition] = useState('WC');
  const [importujZakonczone, setImportujZakonczone] = useState(false);
  const [pendingDruzyny, startDruzyny] = useTransition();
  const [pendingMecze, startMecze] = useTransition();
  const [wynikDruzyny, setWynikDruzyny] = useState(null);
  const [wynikMecze, setWynikMecze] = useState(null);

  const onImportDruzyny = () => {
    setWynikDruzyny(null);
    startDruzyny(async () => {
      const res = await importujDruzyny(competition);
      setWynikDruzyny(res);
    });
  };

  const onImportMecze = () => {
    setWynikMecze(null);
    startMecze(async () => {
      const res = await importujMecze(competition, {
        tylkoPrzyszle: !importujZakonczone,
      });
      setWynikMecze(res);
    });
  };

  const pending = pendingDruzyny || pendingMecze;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-6">
        <h2 className="mb-4 text-xl font-bold text-emerald-50">Rozgrywki</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="competition"
              className="mb-1 block text-sm font-medium text-emerald-200"
            >
              Wybierz rozgrywki
            </label>
            <select
              id="competition"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              disabled={pending}
              className="w-full max-w-md rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-50"
            >
              {DOZWOLONE_COMPETITIONS.map((kod) => (
                <option key={kod} value={kod}>
                  {kod} — {NAZWY_COMPETITIONS[kod]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 text-sm sm:grid-cols-3">
            <Licznik etykieta="Mecze w bazie" wartosc={meczeCount} />
            <Licznik etykieta="Drużyny w bazie" wartosc={druzynyCount} />
            <Licznik
              etykieta="Drużyny zmapowane do API"
              wartosc={druzynyZmapowane}
              ostrzezenie={druzynyZmapowane === 0}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-6">
        <h2 className="mb-1 text-xl font-bold text-emerald-50">Krok 1 — Drużyny</h2>
        <p className="mb-4 text-sm text-emerald-200/70">
          Pobierz listę drużyn dla wybranych rozgrywek. Brakujące zostaną dodane,
          a istniejące po nazwie - zmapowane do API.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onImportDruzyny} disabled={pending}>
            {pendingDruzyny ? 'Importuję drużyny…' : '📥 Importuj drużyny dla tej competycji'}
          </Button>
          {pendingDruzyny && (
            <span className="inline-flex items-center gap-2 text-sm text-emerald-200/80">
              <Spinner />
              Pobieram listę zespołów z Football-Data.org…
            </span>
          )}
        </div>

        {wynikDruzyny && !pendingDruzyny && (
          <div className="mt-4">
            <PodsumowanieDruzyn wynik={wynikDruzyny} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-6">
        <h2 className="mb-1 text-xl font-bold text-emerald-50">Krok 2 — Mecze</h2>
        <p className="mb-4 text-sm text-emerald-200/70">
          Po imporcie drużyn pobierz harmonogram meczów. Mecze, których drużyny
          nie są zmapowane, zostaną pominięte.
        </p>

        <div className="mb-4">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-emerald-100">
            <input
              type="checkbox"
              checked={importujZakonczone}
              onChange={(e) => setImportujZakonczone(e.target.checked)}
              disabled={pending}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-emerald-700/60 bg-emerald-950/50 text-emerald-500 focus:ring-emerald-400/40 disabled:opacity-50"
            />
            <span>
              Importuj też zakończone mecze (historia)
              <span className="mt-0.5 block text-xs text-emerald-200/60">
                ℹ️ Zwykle wystarczą tylko przyszłe i trwające mecze.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onImportMecze} disabled={pending}>
            {pendingMecze ? 'Importuję mecze…' : '📥 Importuj mecze'}
          </Button>
          {pendingMecze && (
            <span className="inline-flex items-center gap-2 text-sm text-emerald-200/80">
              <Spinner />
              Importuję mecze, to może potrwać do 30 sekund…
            </span>
          )}
        </div>

        {wynikMecze && !pendingMecze && (
          <div className="mt-4">
            <PodsumowanieImportu wynik={wynikMecze} />
          </div>
        )}
      </section>
    </div>
  );
}

function PodsumowanieDruzyn({ wynik }) {
  if (!wynik.success) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
        ❌ Import drużyn nie powiódł się: {wynik.error || 'nieznany błąd'}.
      </div>
    );
  }

  const { imported, updated, skipped, errors } = wynik;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Wiersz emoji="✅" tekst={`Dodano ${imported} drużyn`} kolor="emerald" />
        <Wiersz
          emoji="🔗"
          tekst={`Zmapowano ${updated} istniejących drużyn`}
          kolor={updated > 0 ? 'emerald' : 'slate'}
        />
        <Wiersz emoji="⏭️" tekst={`Pominięto ${skipped} (już zmapowane)`} kolor="slate" />
        <Wiersz
          emoji="❌"
          tekst={`Błędy: ${errors?.length ?? 0}`}
          kolor={errors?.length ? 'red' : 'slate'}
        />
      </div>

      {errors?.length > 0 && (
        <details className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          <summary className="cursor-pointer font-semibold">
            Lista błędów ({errors.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      {imported === 0 && updated === 0 && skipped === 0 && (
        <p className="text-sm text-emerald-200/70">
          API nie zwróciło żadnych drużyn dla tej competycji.
        </p>
      )}
    </div>
  );
}

function PodsumowanieImportu({ wynik }) {
  if (!wynik.success) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
        ❌ Import nie powiódł się: {wynik.error || 'nieznany błąd'}.
      </div>
    );
  }

  const { imported, updatedMeta = 0, skipped, skippedNoMapping, errors } = wynik;
  const calkowicie =
    imported === 0 && updatedMeta === 0 && skipped === 0 && skippedNoMapping === 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Wiersz emoji="✅" tekst={`Zaimportowano ${imported} meczów`} kolor="emerald" />
        <Wiersz
          emoji="🔁"
          tekst={`Uzupełniono kod rozgrywek/grupę dla ${updatedMeta} meczów`}
          kolor={updatedMeta > 0 ? 'emerald' : 'slate'}
        />
        <Wiersz emoji="⏭️" tekst={`Pominięto ${skipped} meczów (już mają komplet danych)`} kolor="slate" />
        <Wiersz
          emoji="⚠️"
          tekst={`Pominięto ${skippedNoMapping} meczów (brak zmapowanych drużyn)`}
          kolor={skippedNoMapping > 0 ? 'amber' : 'slate'}
        />
        <Wiersz
          emoji="❌"
          tekst={`Błędy: ${errors?.length ?? 0}`}
          kolor={errors?.length ? 'red' : 'slate'}
        />
      </div>

      {errors?.length > 0 && (
        <details className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          <summary className="cursor-pointer font-semibold">
            Lista błędów ({errors.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      {skippedNoMapping > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Aby zaimportować pozostałe mecze, najpierw zaimportuj drużyny (Krok 1)
          albo zmapuj je w{' '}
          <Link
            href="/admin/druzyny/mapowanie"
            className="font-semibold underline hover:text-amber-50"
          >
            /admin/druzyny/mapowanie
          </Link>
          .
          {wynik.niezmapowaneDruzyny?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">
                Brakujące drużyny ({wynik.niezmapowaneDruzyny.length})
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {wynik.niezmapowaneDruzyny.map((d) => (
                  <li key={d.externalId}>
                    {d.name} <span className="text-amber-200/70">(API id: {d.externalId})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {calkowicie && (errors?.length ?? 0) === 0 && (
        <p className="text-sm text-emerald-200/70">
          API nie zwróciło żadnych meczów dla wybranych rozgrywek.
        </p>
      )}

      <div className="pt-1">
        <Link
          href="/admin/mecze"
          className="text-sm font-semibold text-emerald-300 underline hover:text-emerald-200"
        >
          Zobacz mecze w panelu →
        </Link>
      </div>
    </div>
  );
}

function Licznik({ etykieta, wartosc, ostrzezenie = false }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        ostrzezenie
          ? 'border-amber-500/40 bg-amber-950/30'
          : 'border-emerald-900/40 bg-emerald-950/40'
      }`}
    >
      <div
        className={`text-lg font-bold ${
          ostrzezenie ? 'text-amber-100' : 'text-emerald-50'
        }`}
      >
        {wartosc}
      </div>
      <div
        className={`text-xs ${
          ostrzezenie ? 'text-amber-200/80' : 'text-emerald-200/70'
        }`}
      >
        {etykieta}
      </div>
    </div>
  );
}

function Wiersz({ emoji, tekst, kolor }) {
  const klasy = {
    emerald: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100',
    amber: 'border-amber-500/40 bg-amber-950/30 text-amber-100',
    red: 'border-red-500/40 bg-red-950/30 text-red-100',
    slate: 'border-emerald-900/40 bg-emerald-950/30 text-emerald-200/80',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${klasy[kolor] || klasy.slate}`}>
      <span className="mr-2">{emoji}</span>
      {tekst}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-300/40 border-t-emerald-300"
    />
  );
}

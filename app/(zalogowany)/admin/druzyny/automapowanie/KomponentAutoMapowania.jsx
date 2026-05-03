'use client';

// Trzy sekcje wyników auto-mapowania:
//   ✅ AUTO-ZMAPOWANE   - confidence >= 0.85 (dictionary/exact/fuzzy_high)
//   ⚠️ DO POTWIERDZENIA  - 0.6 <= confidence < 0.85 (fuzzy_medium)
//   ✗ BRAK DOPASOWANIA  - confidence < 0.6 (none)
//
// Każda sekcja ma własną logikę:
//   - AUTO: globalny przycisk "Zatwierdź wszystkie" + pojedynczy "Zatwierdź" / "Pomiń"
//   - MEDIUM: dropdown z top 3 + "Zatwierdź" / "Pomiń"
//   - NONE: select po wszystkich drużynach API + "Zatwierdź"
//
// Wszystkie ścieżki kończą się tym samym - zapiszMapowaniaZespolow z listą
// {teamId, externalId}. Po sukcesie router.refresh() - rerender z aktualnymi
// danymi z bazy (drużyna znika z listy, jej external_id zajmuje slot).

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import { zapiszMapowaniaZespolow } from '@/app/akcje/api';

const ETYKIETY_SOURCE = {
  dictionary: 'słownik',
  exact: 'dokładny',
  fuzzy_high: 'fuzzy',
  fuzzy_medium: 'fuzzy',
  none: '—',
};

function procent(c) {
  return `${Math.round((c || 0) * 100)}%`;
}

export default function KomponentAutoMapowania({ dopasowania, apiDruzyny }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [komunikat, setKomunikat] = useState(null);

  // Per-team override - jeśli admin zmienił sugestię w dropdownie, trzymamy
  // wybór tutaj. Klucz = teamId, wartość = externalId (number) lub ''.
  const [wybory, setWybory] = useState({});

  // Lokalnie odhaczone "pominięte" drużyny - chowamy je z UI bez zapisu w bazie.
  const [pominiete, setPominiete] = useState(() => new Set());

  const apiPosortowane = useMemo(
    () => [...apiDruzyny].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl')),
    [apiDruzyny],
  );

  const auto = [];
  const medium = [];
  const none = [];
  for (const d of dopasowania) {
    if (pominiete.has(d.druzyna.id)) continue;
    if (d.wynik.source === 'fuzzy_medium') medium.push(d);
    else if (d.wynik.source === 'none') none.push(d);
    else auto.push(d); // dictionary / exact / fuzzy_high
  }

  // externalId aktualnie wybranego dla danej drużyny - override > sugestia.
  function externalIdDla(d) {
    const override = wybory[d.druzyna.id];
    if (override !== undefined) return override === '' ? null : Number(override);
    return d.wynik.matched?.id ?? null;
  }

  function ustaw(teamId, value) {
    setWybory((s) => ({ ...s, [teamId]: value }));
  }

  function pomin(teamId) {
    setPominiete((s) => {
      const next = new Set(s);
      next.add(teamId);
      return next;
    });
  }

  async function zapisz(lista) {
    setKomunikat(null);
    start(async () => {
      const res = await zapiszMapowaniaZespolow(lista);
      setKomunikat(res);
      if (res?.ok) router.refresh();
    });
  }

  function zatwierdzJedna(d) {
    const ext = externalIdDla(d);
    if (ext == null) {
      setKomunikat({ error: 'Wybierz drużynę z API zanim zatwierdzisz.' });
      return;
    }
    zapisz([{ teamId: d.druzyna.id, externalId: ext }]);
  }

  function zatwierdzWszystkieAuto() {
    const lista = auto
      .map((d) => ({ teamId: d.druzyna.id, externalId: externalIdDla(d) }))
      .filter((m) => m.externalId != null);
    if (lista.length === 0) {
      setKomunikat({ error: 'Brak auto-dopasowań do zapisania.' });
      return;
    }
    zapisz(lista);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 text-sm text-emerald-200/80">
        <span>
          Wszystkich:{' '}
          <span className="font-semibold text-emerald-100">{dopasowania.length}</span>
        </span>
        <span>
          ✅ Auto: <span className="font-semibold text-emerald-100">{auto.length}</span>
        </span>
        <span>
          ⚠️ Do potwierdzenia:{' '}
          <span className="font-semibold text-emerald-100">{medium.length}</span>
        </span>
        <span>
          ✗ Brak: <span className="font-semibold text-emerald-100">{none.length}</span>
        </span>
      </div>

      {komunikat?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {komunikat.error}
        </p>
      )}
      {komunikat?.ok && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          {komunikat.ok}
        </p>
      )}

      {/* AUTO-ZMAPOWANE */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-emerald-100">
            ✅ Auto-zmapowane{' '}
            <span className="text-sm font-normal text-emerald-300/70">
              ({auto.length})
            </span>
          </h2>
          {auto.length > 0 && (
            <Button onClick={zatwierdzWszystkieAuto} disabled={pending}>
              {pending ? 'Zapisuję…' : `Zatwierdź wszystkie (${auto.length})`}
            </Button>
          )}
        </div>
        {auto.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
            Brak auto-dopasowanych drużyn.
          </p>
        ) : (
          <ul className="space-y-2">
            {auto.map((d) => (
              <li
                key={d.druzyna.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-900/15 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-emerald-50">
                    <span className="font-semibold">{d.druzyna.name}</span>
                    <span className="mx-2 text-emerald-400">→</span>
                    <span>{d.wynik.matched.name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-300/70">
                    {procent(d.wynik.confidence)}, {ETYKIETY_SOURCE[d.wynik.source]}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => zatwierdzJedna(d)}
                    disabled={pending}
                  >
                    Zatwierdź
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => pomin(d.druzyna.id)}
                    disabled={pending}
                  >
                    Pomiń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* DO POTWIERDZENIA */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-emerald-100">
          ⚠️ Do potwierdzenia{' '}
          <span className="text-sm font-normal text-emerald-300/70">
            ({medium.length})
          </span>
        </h2>
        {medium.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
            Brak drużyn wymagających potwierdzenia.
          </p>
        ) : (
          <ul className="space-y-2">
            {medium.map((d) => {
              const wybrane =
                wybory[d.druzyna.id] !== undefined
                  ? String(wybory[d.druzyna.id])
                  : String(d.wynik.matched.id);
              return (
                <li
                  key={d.druzyna.id}
                  className="rounded-xl border border-amber-400/30 bg-amber-900/10 px-4 py-3"
                >
                  <div className="font-semibold text-emerald-50">
                    {d.druzyna.name}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-emerald-200/70">Sugestia:</span>
                    <select
                      value={wybrane}
                      onChange={(e) => ustaw(d.druzyna.id, e.target.value)}
                      className="min-w-[14rem] rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-1.5 text-sm text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    >
                      {d.wynik.suggestions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({procent(s.confidence)})
                        </option>
                      ))}
                      <option value="">— wybierz inną z pełnej listy —</option>
                    </select>
                    {wybory[d.druzyna.id] === '' && (
                      <select
                        onChange={(e) => ustaw(d.druzyna.id, e.target.value)}
                        defaultValue=""
                        className="min-w-[14rem] rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-1.5 text-sm text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option value="">— wszystkie drużyny API —</option>
                        {apiPosortowane.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      variant="primary"
                      onClick={() => zatwierdzJedna(d)}
                      disabled={pending}
                    >
                      Zatwierdź
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => pomin(d.druzyna.id)}
                      disabled={pending}
                    >
                      Pomiń
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* BRAK DOPASOWANIA */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-emerald-100">
          ✗ Brak dopasowania{' '}
          <span className="text-sm font-normal text-emerald-300/70">
            ({none.length})
          </span>
        </h2>
        {none.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
            Wszystkie drużyny mają jakieś dopasowanie.
          </p>
        ) : (
          <ul className="space-y-2">
            {none.map((d) => {
              const wybrane =
                wybory[d.druzyna.id] !== undefined ? String(wybory[d.druzyna.id]) : '';
              return (
                <li
                  key={d.druzyna.id}
                  className="rounded-xl border border-red-500/30 bg-red-900/10 px-4 py-3"
                >
                  <div className="font-semibold text-emerald-50">
                    {d.druzyna.name}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-emerald-200/70">
                      Wybierz ręcznie:
                    </span>
                    <select
                      value={wybrane}
                      onChange={(e) => ustaw(d.druzyna.id, e.target.value)}
                      className="min-w-[16rem] rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-1.5 text-sm text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    >
                      <option value="">— brak —</option>
                      {apiPosortowane.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      onClick={() => zatwierdzJedna(d)}
                      disabled={pending || !wybrane}
                    >
                      Zatwierdź
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => pomin(d.druzyna.id)}
                      disabled={pending}
                    >
                      Pomiń
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

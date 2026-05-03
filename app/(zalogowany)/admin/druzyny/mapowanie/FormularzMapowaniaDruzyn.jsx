'use client';

// Tabela mapowań: każda nasza drużyna -> select z drużynami z API.
// Stan trzymamy w lokalnym useState (klucz = teamId, wartość = externalId|''),
// inicjalizowany z aktualnego external_id w bazie. Submit wysyła całą paczkę
// jednym wywołaniem akcji zapiszMapowaniaZespolow.

import { useMemo, useState, useTransition } from 'react';
import Button from '@/components/Button';
import { zapiszMapowaniaZespolow } from '@/app/akcje/api';

export default function FormularzMapowaniaDruzyn({ druzyny, apiDruzyny, apiOk }) {
  const [stanMapowan, setStanMapowan] = useState(() => {
    const m = {};
    for (const d of druzyny) m[d.id] = d.external_id == null ? '' : String(d.external_id);
    return m;
  });
  const [pending, start] = useTransition();
  const [komunikat, setKomunikat] = useState(null);

  const apiPosortowane = useMemo(
    () => [...apiDruzyny].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl')),
    [apiDruzyny],
  );

  const ustaw = (teamId, value) => {
    setStanMapowan((s) => ({ ...s, [teamId]: value }));
  };

  const submit = () => {
    const lista = druzyny.map((d) => ({
      teamId: d.id,
      externalId: stanMapowan[d.id] === '' ? null : Number(stanMapowan[d.id]),
    }));
    setKomunikat(null);
    start(async () => {
      const res = await zapiszMapowaniaZespolow(lista);
      setKomunikat(res);
    });
  };

  // Liczba zmapowanych vs całość - widoczne nad tabelą.
  const zmapowanych = Object.values(stanMapowan).filter((v) => v !== '').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-200/80">
        <span>
          Zmapowanych: <span className="font-semibold text-emerald-100">{zmapowanych}</span>{' '}
          / {druzyny.length}
        </span>
        <span>
          Drużyn w API: <span className="font-semibold text-emerald-100">{apiDruzyny.length}</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-900/40">
        <table className="w-full text-sm">
          <thead className="bg-emerald-900/40 text-emerald-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Nasza drużyna</th>
              <th className="px-4 py-2 text-left font-semibold">Drużyna z API</th>
            </tr>
          </thead>
          <tbody>
            {druzyny.map((d) => {
              const wartosc = stanMapowan[d.id] ?? '';
              return (
                <tr key={d.id} className="border-t border-emerald-900/40 bg-emerald-900/10">
                  <td className="px-4 py-2 align-middle text-emerald-50">{d.name}</td>
                  <td className="px-4 py-2 align-middle">
                    <select
                      value={wartosc}
                      onChange={(e) => ustaw(d.id, e.target.value)}
                      disabled={!apiOk}
                      className="w-full max-w-md rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-1.5 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-50"
                    >
                      <option value="">— brak (nie aktualizuj automatycznie) —</option>
                      {apiPosortowane.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (id: {a.id})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || !apiOk}>
          {pending ? 'Zapisuję…' : 'Zapisz wszystkie mapowania'}
        </Button>
        {!apiOk && (
          <span className="text-xs text-amber-200/80">
            Brak danych z API — naprawić klucz/limit i odświeżyć stronę.
          </span>
        )}
      </div>
    </div>
  );
}

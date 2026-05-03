'use client';

// Tabela mapowań meczów. Każdy nasz mecz ma <select> z meczami z API,
// posortowany po dacie. Default = auto-sugestia z serwera (jeśli była).
// Submit wysyła całą paczkę przez akcję zapiszMapowaniaMeczow.

import { useMemo, useState, useTransition } from 'react';
import Button from '@/components/Button';
import { zapiszMapowaniaMeczow } from '@/app/akcje/api';
import { formatujDateKrotkoPL } from '@/lib/format';

export default function FormularzMapowaniaMeczow({
  mecze,
  apiMecze,
  sugestie,
  apiOk,
}) {
  const [stan, setStan] = useState(() => {
    const m = {};
    for (const mecz of mecze) {
      const sug = sugestie?.[mecz.id];
      m[mecz.id] = sug == null ? '' : String(sug);
    }
    return m;
  });
  const [pending, start] = useTransition();
  const [komunikat, setKomunikat] = useState(null);

  // Mecze z API posortowane po dacie - select pokaże je w naturalnej kolejności.
  const apiPosortowane = useMemo(
    () =>
      [...apiMecze].sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      ),
    [apiMecze],
  );

  const ustaw = (matchId, value) => {
    setStan((s) => ({ ...s, [matchId]: value }));
  };

  const submit = () => {
    // Wysyłamy TYLKO mecze, którym admin coś przypisał (externalId != '').
    // Pozostałe pomijamy, żeby nie nadpisywać ich na NULL bez powodu.
    const lista = mecze
      .map((m) => ({
        matchId: m.id,
        externalId: stan[m.id] === '' ? null : Number(stan[m.id]),
      }))
      .filter((it) => it.externalId != null);

    if (lista.length === 0) {
      setKomunikat({ error: 'Nic nie wybrano - wybierz przynajmniej jeden mecz z API.' });
      return;
    }

    setKomunikat(null);
    start(async () => {
      const res = await zapiszMapowaniaMeczow(lista);
      setKomunikat(res);
    });
  };

  const zaznaczone = Object.values(stan).filter((v) => v !== '').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-200/80">
        <span>
          Z auto-sugestii / wybranych: <span className="font-semibold text-emerald-100">{zaznaczone}</span>{' '}
          / {mecze.length}
        </span>
        <span>
          Meczów w API: <span className="font-semibold text-emerald-100">{apiMecze.length}</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-900/40">
        <table className="w-full text-sm">
          <thead className="bg-emerald-900/40 text-emerald-100">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Nasz mecz</th>
              <th className="px-4 py-2 text-left font-semibold">Mecz z API</th>
            </tr>
          </thead>
          <tbody>
            {mecze.map((m) => {
              const wartosc = stan[m.id] ?? '';
              const sug = sugestie?.[m.id];
              const home = m.home_team?.name || `#${m.home_team?.id ?? '?'}`;
              const away = m.away_team?.name || `#${m.away_team?.id ?? '?'}`;
              const homeExt = m.home_team?.external_id;
              const awayExt = m.away_team?.external_id;
              const brakujeMapowaniaDruzyn = homeExt == null || awayExt == null;
              return (
                <tr key={m.id} className="border-t border-emerald-900/40 bg-emerald-900/10 align-top">
                  <td className="px-4 py-3 text-emerald-50">
                    <div className="font-semibold">
                      {home} <span className="text-emerald-300/60">vs</span> {away}
                    </div>
                    <div className="mt-1 text-xs text-emerald-200/70">
                      {formatujDateKrotkoPL(m.kickoff_at)}
                    </div>
                    {brakujeMapowaniaDruzyn && (
                      <div className="mt-1 text-xs text-amber-200/80">
                        Brak external_id u {homeExt == null ? 'gospodarzy' : 'gości'} —
                        auto-sugestia niemożliwa.
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={wartosc}
                      onChange={(e) => ustaw(m.id, e.target.value)}
                      disabled={!apiOk}
                      className="w-full max-w-xl rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-1.5 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-50"
                    >
                      <option value="">— nie mapuj —</option>
                      {apiPosortowane.map((a) => {
                        const opisDruzyn = `${a.homeTeam?.name ?? '?'} vs ${a.awayTeam?.name ?? '?'}`;
                        const opisDaty = a.utcDate ? formatujDateKrotkoPL(a.utcDate) : '?';
                        const isAuto = sug != null && a.id === sug;
                        return (
                          <option key={a.id} value={a.id}>
                            {isAuto ? '★ ' : ''}
                            {opisDruzyn} — {opisDaty} (id: {a.id})
                          </option>
                        );
                      })}
                    </select>
                    {sug != null && (
                      <div className="mt-1 text-xs text-emerald-300/80">
                        ★ Auto-sugestia: id {sug}
                      </div>
                    )}
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

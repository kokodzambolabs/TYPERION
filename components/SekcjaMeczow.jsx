'use client';

// Sekcja meczów z paginacją "pokaż więcej".
// Trzyma początkowy zestaw meczów z Server Componentu i potrafi
// dociągnąć więcej przez Server Action pobierzWiecejMeczow.
//
// Obie kategorie ('nadchodzace' i 'zakonczone') doczytują porcjami
// po LIMIT_PORCJI - max 50 na request (limit zod w Server Action).

import { useEffect, useState, useTransition } from 'react';
import KartaMeczu from './KartaMeczu';
import { pobierzWiecejMeczow } from '@/app/akcje/typy';

const LIMIT_PORCJI = 30;

export default function SekcjaMeczow({
  tytul,
  kategoria,
  mecze,
  typy,
  total,
  stan,
  pusty,
  sectionId,
}) {
  const [lista, setLista] = useState(mecze);
  const [typyMap, setTypyMap] = useState(
    () => new Map((typy || []).map((t) => [t.match_id, t])),
  );
  const [pending, start] = useTransition();
  const [blad, setBlad] = useState(null);
  const [scrollDoId, setScrollDoId] = useState(null);

  const pozostalo = Math.max(total - lista.length, 0);
  const wszystkieZaladowane = pozostalo === 0;

  // Po dociągnięciu kolejnej porcji - smooth scroll do pierwszego nowego meczu,
  // żeby user nie musiał szukać gdzie się skończyło to co już widział.
  useEffect(() => {
    if (!scrollDoId) return;
    const el = document.getElementById(`match-${scrollDoId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollDoId(null);
  }, [scrollDoId]);

  const dociagnij = () => {
    setBlad(null);
    start(async () => {
      const res = await pobierzWiecejMeczow({
        kategoria,
        offset: lista.length,
        limit: LIMIT_PORCJI,
      });
      if (res.error) {
        setBlad(res.error);
        return;
      }
      const nowe = res.mecze || [];
      setLista((p) => [...p, ...nowe]);
      setTypyMap((p) => {
        const next = new Map(p);
        for (const t of res.typy || []) next.set(t.match_id, t);
        return next;
      });
      if (nowe[0]) setScrollDoId(nowe[0].id);
    });
  };

  return (
    <section id={sectionId}>
      <h2 className="mb-3 text-lg font-semibold text-emerald-100">
        {tytul}
        {total > 0 && (
          <span className="ml-2 text-sm font-normal text-emerald-300/70">
            ({total})
          </span>
        )}
      </h2>

      {lista.length === 0 ? (
        <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
          {pusty}
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((m) => {
            const t = typyMap.get(m.id);
            return (
              <li key={m.id}>
                <KartaMeczu
                  key={`${m.id}-${t?.updated_at ?? 'pusta'}-${t?.winner_team_id ?? 'x'}`}
                  mecz={m}
                  typ={t}
                  stan={stan}
                  anchorId={`match-${m.id}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {!wszystkieZaladowane && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={dociagnij}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-700/50 bg-emerald-900/30 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/50 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Spinner /> Ładuję…
              </>
            ) : (
              `Pokaż więcej (zostało: ${pozostalo})`
            )}
          </button>
          <span className="text-xs text-emerald-300/70">
            Pokazane {lista.length} z {total}
          </span>
        </div>
      )}

      {blad && (
        <p className="mt-2 text-sm text-rose-300">{blad}</p>
      )}
    </section>
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

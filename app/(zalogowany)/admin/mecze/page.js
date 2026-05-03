// Lista meczów - 5 sekcji wg klasyfikacji z lib/klasyfikacjaMeczow:
//   🔴 Trwające teraz   - status='live' lub kickoff_at w oknie [now-3h, now]
//   📅 Dzisiaj          - 'scheduled' i kickoff_at to dziś (PL) i > now()
//   🌅 Jutro            - 'scheduled' i kickoff_at to jutro (PL)
//   ⏭️ Nadchodzące      - 'scheduled' i data PL >= pojutrze
//   ✅ Zakończone       - 'finished' lub "sierota" (kickoff > 3h temu, brak wyniku)
//
// "Sierota" w sekcji Zakończone dostaje badge "⚠️ Wynik niedostępny" - admin
// widzi jakie mecze wpadają tu automatycznie, mimo że w bazie nie mają wyniku.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/Button';
import KartaMeczuAdmin from '@/components/KartaMeczuAdmin';
import PrzyciskOdswiezWyniki from '@/components/PrzyciskOdswiezWyniki';
import { klasyfikujMecze, jestSierota } from '@/lib/klasyfikacjaMeczow';

export default async function MeczeAdminPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const status = sp.status;
  const supabase = await createClient();
  const { data: mecze } = await supabase
    .from('matches')
    .select(
      `
        id, kickoff_at, status, home_score, away_score, home_team_id, away_team_id,
        competition_code, group_name,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `,
    )
    .order('kickoff_at', { ascending: false });

  const list = mecze || [];
  // klasyfikujMecze zwraca też `now` żeby komponent nie wywoływał Date.now()
  // bezpośrednio w renderze (Next 16 react-hooks/purity).
  const { trwajace, dzisiaj, jutro, nadchodzace, zakonczone, now: teraz } =
    klasyfikujMecze(list);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-emerald-50">Mecze</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PrzyciskOdswiezWyniki />
          <Link href="/admin/mecze/mapowanie">
            <Button variant="secondary">🔗 Mapuj mecze do API</Button>
          </Link>
          <Link href="/admin/mecze/nowy">
            <Button variant="primary">+ Dodaj mecz</Button>
          </Link>
        </div>
      </div>

      {status === 'wynik-zapisany' && (
        <div className="mb-6 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Wynik zapisany, punkty rozliczone.
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak meczów. Dodaj pierwszy mecz.
        </div>
      ) : (
        <div className="space-y-8">
          <Sekcja
            tytul="🔴 Trwające teraz"
            mecze={trwajace}
            teraz={teraz}
            pusty="Brak trwających meczów."
          />
          <Sekcja
            tytul="📅 Dzisiaj"
            mecze={dzisiaj}
            teraz={teraz}
            pusty="Brak meczów na dziś."
          />
          <Sekcja
            tytul="🌅 Jutro"
            mecze={jutro}
            teraz={teraz}
            pusty="Brak meczów na jutro."
          />
          <Sekcja
            tytul="⏭️ Nadchodzące"
            mecze={nadchodzace}
            teraz={teraz}
            pusty="Brak nadchodzących meczów."
          />
          <Sekcja
            tytul="✅ Zakończone"
            mecze={zakonczone}
            teraz={teraz}
            pusty="Brak zakończonych meczów."
          />
        </div>
      )}
    </main>
  );
}

function Sekcja({ tytul, mecze, teraz, pusty }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-emerald-100">
        {tytul}
        <span className="ml-2 text-sm font-normal text-emerald-300/70">
          ({mecze.length})
        </span>
      </h2>
      {mecze.length === 0 ? (
        <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
          {pusty}
        </p>
      ) : (
        <ul className="space-y-2">
          {mecze.map((m) => (
            <li key={m.id}>
              <KartaMeczuAdmin
                mecz={m}
                poKickoff={new Date(m.kickoff_at).getTime() <= teraz}
                sierota={jestSierota(m, teraz)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

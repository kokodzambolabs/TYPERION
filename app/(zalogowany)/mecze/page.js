// Strona /mecze - pięć sekcji:
//   1) Skrót (ile masz nietypowanych + skok do pierwszego)
//   2) 🔴 Trwające teraz - patrz lib/klasyfikacjaMeczow (okno 3h od kickoffu)
//   3) 📅 Dzisiaj - status='scheduled' AND kickoff_at jest dziś (PL) AND > now()
//   4) 🌅 Jutro - status='scheduled' AND kickoff_at jest jutro (PL); bez paginacji
//   5) ⏭️ Nadchodzące - status='scheduled' AND data PL >= pojutrze - paginacja 6 + reszta
//   6) ✅ Zakończone - finished LUB "sierota" (kickoff > 3h temu bez wyniku);
//      paginacja 5 + dociąganie po 10
//
// Pobieramy całą listę meczów w jednym zapytaniu, kategoryzujemy w JS
// (klasyfikujMecze) i podajemy do Client Componentów odpowiednie "okna" +
// całkowity total dla paginacji. Klient dociąga porcjami po 30 (max 50/req).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import KartaMeczu from '@/components/KartaMeczu';
import SekcjaMeczow from '@/components/SekcjaMeczow';
import { klasyfikujMecze } from '@/lib/klasyfikacjaMeczow';

const POCZATKOWE_NADCHODZACE = 6;
const POCZATKOWE_ZAKONCZONE = 5;

export default async function MeczePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/logowanie');

  const [{ data: mecze }, { data: typy }] = await Promise.all([
    supabase
      .from('matches')
      .select(
        `
          id, kickoff_at, status, home_score, away_score, home_team_id, away_team_id,
          competition_code, group_name,
          home_team:home_team_id ( id, name ),
          away_team:away_team_id ( id, name )
        `,
      )
      .order('kickoff_at', { ascending: true }),
    supabase
      .from('predictions')
      .select('match_id, home_score, away_score, points')
      .eq('user_id', user.id),
  ]);

  const list = mecze || [];
  const { trwajace, dzisiaj, jutro, nadchodzace, zakonczone } =
    klasyfikujMecze(list);

  const typyMap = new Map((typy || []).map((t) => [t.match_id, t]));
  const matyp = (m) => typyMap.has(m.id);

  const nietypowaneDzisiaj = dzisiaj.filter((m) => !matyp(m));
  const nietypowaneJutro = jutro.filter((m) => !matyp(m));
  const nietypowaneNadch = nadchodzace.filter((m) => !matyp(m));
  const liczbaNietypowanych =
    nietypowaneDzisiaj.length + nietypowaneJutro.length + nietypowaneNadch.length;

  // Pierwszy nietypowany - target dla "Skocz do nietypowanych".
  // Jeśli jest w nadchodzących na pozycji >= POCZATKOWE_NADCHODZACE, rozszerzamy
  // wstępne okno tak, by anchor mógł trafić w istniejący element DOM.
  const pierwszyNietypowany =
    nietypowaneDzisiaj[0] ?? nietypowaneJutro[0] ?? nietypowaneNadch[0] ?? null;

  let nadchPokazTeraz = POCZATKOWE_NADCHODZACE;
  if (
    pierwszyNietypowany &&
    !nietypowaneDzisiaj[0] &&
    !nietypowaneJutro[0]
  ) {
    const idx = nadchodzace.findIndex((m) => m.id === pierwszyNietypowany.id);
    if (idx >= POCZATKOWE_NADCHODZACE) {
      nadchPokazTeraz = idx + 1;
    }
  }

  const nadchPocz = nadchodzace.slice(0, nadchPokazTeraz);
  const zakonPocz = zakonczone.slice(0, POCZATKOWE_ZAKONCZONE);

  const typyDla = (mecze) => {
    const ids = new Set(mecze.map((m) => m.id));
    return (typy || []).filter((t) => ids.has(t.match_id));
  };

  if (list.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-emerald-50">Mecze</h1>
        <PustaLista />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="mb-4 text-3xl font-bold text-emerald-50">Mecze</h1>

      <Skrot
        liczba={liczbaNietypowanych}
        targetId={pierwszyNietypowany ? `match-${pierwszyNietypowany.id}` : null}
      />

      <div className="space-y-7">
        {trwajace.length > 0 && (
          <SekcjaStatyczna
            tytul="🔴 Trwające teraz"
            mecze={trwajace}
            typyMap={typyMap}
            stan="live"
          />
        )}

        {dzisiaj.length > 0 && (
          <SekcjaStatyczna
            tytul="📅 Dzisiaj"
            mecze={dzisiaj}
            typyMap={typyMap}
            stan="scheduled"
          />
        )}

        {jutro.length > 0 && (
          <SekcjaStatyczna
            tytul="🌅 Jutro"
            mecze={jutro}
            typyMap={typyMap}
            stan="scheduled"
          />
        )}

        {nadchodzace.length > 0 && (
          <SekcjaMeczow
            tytul="⏭️ Nadchodzące"
            kategoria="nadchodzace"
            sectionId="sekcja-nadchodzace"
            mecze={nadchPocz}
            typy={typyDla(nadchPocz)}
            total={nadchodzace.length}
            stan="scheduled"
            pusty="Brak nadchodzących meczów."
          />
        )}

        {zakonczone.length > 0 && (
          <SekcjaMeczow
            tytul="✅ Zakończone"
            kategoria="zakonczone"
            sectionId="sekcja-zakonczone"
            mecze={zakonPocz}
            typy={typyDla(zakonPocz)}
            total={zakonczone.length}
            stan="finished"
            pusty="Brak zakończonych meczów."
          />
        )}

        {trwajace.length === 0 &&
          dzisiaj.length === 0 &&
          jutro.length === 0 &&
          nadchodzace.length === 0 &&
          zakonczone.length === 0 && <PustaLista />}
      </div>
    </main>
  );
}

function Skrot({ liczba, targetId }) {
  if (liczba > 0 && targetId) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm text-amber-100">
          🎯 Masz <strong>{liczba}</strong>{' '}
          {liczba === 1 ? 'nietypowany mecz' : 'nietypowanych meczów'}.
        </p>
        <Link
          href={`#${targetId}`}
          className="inline-flex items-center rounded-md bg-amber-500/30 px-3 py-1.5 text-sm font-semibold text-amber-50 hover:bg-amber-500/40"
        >
          ⚡ Skocz do nietypowanych
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
      ✓ Wszystkie nadchodzące mecze są obstawione!
    </div>
  );
}

function SekcjaStatyczna({ tytul, mecze, typyMap, stan }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-emerald-100">
        {tytul}
        <span className="ml-2 text-sm font-normal text-emerald-300/70">
          ({mecze.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {mecze.map((m) => (
          <li key={m.id}>
            <KartaMeczu
              mecz={m}
              typ={typyMap.get(m.id)}
              stan={stan}
              anchorId={`match-${m.id}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PustaLista() {
  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
      <p className="text-lg font-semibold text-emerald-100">
        Brak meczów do typowania
      </p>
      <p className="mt-1 text-sm">Zajrzyj tu, kiedy admin doda terminarz.</p>
    </div>
  );
}

// Profil innego usera (lub własny) - lista wszystkich jego typów
// pogrupowana na trzy sekcje: zakończone / trwające / nadchodzące.
// Plus statystyki rankingowe (bonusy + mecze + suma + pozycja).
//
// Bezpieczeństwo:
//   - Cudze typy meczów NADCHODZĄCYCH są UKRYTE - RLS to zapewnia
//     (predictions_select_own_or_after_kickoff), ale dodatkowo tu
//     ustawiamy home_score/away_score na null jeśli mecz jeszcze
//     się nie rozpoczął i to nie jest profil aktualnego usera
//     (defense in depth - gdyby ktoś usunął RLS lub zrobił bezpośrednie
//     query, server-side filtr i tak zadziała).
//
// Dwa zapytania do matches/teams zamiast embed-a w predictions: ta sama
// historia co w pobierzCudzeTypy - Supabase nie zna FK predictions->profiles,
// embed sypie błędem. Mergujemy ręcznie w JS.

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import KartaTypuUzytkownika from '@/components/KartaTypuUzytkownika';
import { klasyfikujMecze } from '@/lib/klasyfikacjaMeczow';

export default async function ProfilUzytkownikaPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: aktualny },
  } = await supabase.auth.getUser();
  if (!aktualny) redirect('/logowanie');

  const toJaSam = aktualny.id === id;

  // Sprawdzamy is_admin aktualnego usera - admin widzi profile/ranking
  // nawet dla ukrytych botów (bot_ukryty=true), zwykli userzy dostają 404.
  const { data: jaProfil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', aktualny.id)
    .single();
  const jestAdmin = !!jaProfil?.is_admin;

  // Profil tego usera (nick + flagi). Jeśli to ukryty bot i widz nie jest
  // adminem - notFound (jak gdyby usera w ogóle nie było).
  const { data: profil } = await supabase
    .from('profiles')
    .select('id, nick, is_bot, bot_ukryty')
    .eq('id', id)
    .single();
  if (!profil) notFound();
  if (profil.bot_ukryty && !jestAdmin) notFound();

  // Ranking: ten sam algorytm co /ranking - 3 SELECT-y i merge w JS.
  // Dla nie-adminów ukryte boty wypadają z liczonej puli (jak na /ranking).
  let profileQuery = supabase.from('profiles').select('id, nick, bot_ukryty');
  if (!jestAdmin) {
    profileQuery = profileQuery.eq('bot_ukryty', false);
  }

  const [{ data: profile }, { data: bonusy }, { data: meczeRanking }] =
    await Promise.all([
      profileQuery,
      supabase.from('bonus_answers').select('user_id, points'),
      supabase.from('predictions').select('user_id, points'),
    ]);

  const sumaBonus = new Map();
  for (const b of bonusy || []) {
    if (b.points == null) continue;
    sumaBonus.set(b.user_id, (sumaBonus.get(b.user_id) || 0) + b.points);
  }
  const sumaMecze = new Map();
  for (const m of meczeRanking || []) {
    if (m.points == null) continue;
    sumaMecze.set(m.user_id, (sumaMecze.get(m.user_id) || 0) + m.points);
  }
  const wiersze = (profile || [])
    .map((p) => {
      const bonus_points = sumaBonus.get(p.id) || 0;
      const match_points = sumaMecze.get(p.id) || 0;
      return {
        user_id: p.id,
        nick: p.nick,
        bonus_points,
        match_points,
        total_points: bonus_points + match_points,
      };
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points)
        return b.total_points - a.total_points;
      return b.match_points - a.match_points;
    })
    .map((w, i) => ({ ...w, pozycja: i + 1 }));

  const moj = wiersze.find((w) => w.user_id === id);

  // Wszystkie typy tego usera + osobno mecze, mergujemy w JS.
  const { data: typy } = await supabase
    .from('predictions')
    .select('match_id, home_score, away_score, points')
    .eq('user_id', id);

  const matchIds = (typy || []).map((t) => t.match_id);
  let meczeSurowe = [];
  if (matchIds.length > 0) {
    const { data } = await supabase
      .from('matches')
      .select(
        `
          id, kickoff_at, status, home_score, away_score,
          home_team_id, away_team_id, competition_code, group_name,
          home_team:home_team_id ( id, name ),
          away_team:away_team_id ( id, name )
        `,
      )
      .in('id', matchIds);
    meczeSurowe = data || [];
  }

  const typyMap = new Map((typy || []).map((t) => [t.match_id, t]));

  // Rozpychamy mecze do predictions z kategorią ze wspólnej klasyfikacji.
  // klasyfikujMecze ma default `now = Date.now()` - bierzemy `teraz` z wyniku,
  // żeby cała strona miała spójny "moment" (bez impure Date.now() w renderze).
  const grupy = klasyfikujMecze(meczeSurowe);
  const teraz = grupy.now;

  // Defense in depth: jeśli to NIE profil aktualnego usera, ukryj typy
  // dla meczów które jeszcze się nie rozpoczęły (kickoff_at > now()).
  // Pole `ukryteTypy` przekazujemy do karty - ona sama nie pokazuje wyniku.
  const zbudujListe = (mecze, stan) =>
    mecze
      .map((m) => {
        const typ = typyMap.get(m.id);
        if (!typ) return null;
        const ukryte =
          !toJaSam && new Date(m.kickoff_at).getTime() > teraz;
        return {
          mecz: m,
          typ: ukryte
            ? { home_score: null, away_score: null, points: null }
            : typ,
          ukryte,
          stan,
        };
      })
      .filter(Boolean);

  // Sekcje wyświetlamy posortowane MALEJĄCO po kickoff_at - najnowsze u góry.
  const malejaco = (a, b) =>
    new Date(b.mecz.kickoff_at) - new Date(a.mecz.kickoff_at);
  const zakonczoneTypy = zbudujListe(grupy.zakonczone, 'finished').sort(malejaco);
  const trwajaceTypy = zbudujListe(grupy.trwajace, 'live').sort(malejaco);
  const nadchodzaceTypy = [
    ...zbudujListe(grupy.dzisiaj, 'scheduled'),
    ...zbudujListe(grupy.jutro, 'scheduled'),
    ...zbudujListe(grupy.nadchodzace, 'scheduled'),
  ].sort(malejaco);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-4">
        <Link
          href="/ranking"
          className="inline-flex items-center gap-1 text-sm text-emerald-200/80 hover:text-emerald-100"
        >
          ← Wróć do rankingu
        </Link>
      </div>

      <header className="mb-6 rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-4 py-4 sm:px-6">
        <h1 className="text-2xl font-bold text-emerald-50 sm:text-3xl">
          {profil.nick}
          {toJaSam && (
            <span className="ml-2 rounded bg-emerald-500/20 px-2 py-0.5 text-sm font-semibold text-emerald-200">
              Ty
            </span>
          )}
        </h1>
        {moj && (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Pozycja" value={`#${moj.pozycja}`} />
            <Stat label="Bonusy" value={moj.bonus_points} />
            <Stat label="Mecze" value={moj.match_points} />
            <Stat label="Suma" value={moj.total_points} highlight />
          </dl>
        )}
      </header>

      <div className="space-y-7">
        {zakonczoneTypy.length > 0 && (
          <Sekcja tytul="✅ Zakończone" lista={zakonczoneTypy} />
        )}
        {trwajaceTypy.length > 0 && (
          <Sekcja tytul="🔴 Trwające" lista={trwajaceTypy} />
        )}
        {nadchodzaceTypy.length > 0 && (
          <Sekcja tytul="📅 Nadchodzące obstawione" lista={nadchodzaceTypy} />
        )}
        {zakonczoneTypy.length === 0 &&
          trwajaceTypy.length === 0 &&
          nadchodzaceTypy.length === 0 && (
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
              {toJaSam
                ? 'Nie typowałeś jeszcze żadnego meczu.'
                : 'Ten user nie typował jeszcze żadnego meczu.'}
            </div>
          )}
      </div>
    </main>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/40 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-emerald-200/60">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-mono font-bold ${
          highlight ? 'text-xl text-emerald-50' : 'text-lg text-emerald-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Sekcja({ tytul, lista }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-emerald-100">
        {tytul}
        <span className="ml-2 text-sm font-normal text-emerald-300/70">
          ({lista.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {lista.map(({ mecz, typ, ukryte, stan }) => (
          <li key={mecz.id}>
            <KartaTypuUzytkownika
              mecz={mecz}
              typ={typ}
              ukryte={ukryte}
              stan={stan}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

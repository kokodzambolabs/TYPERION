// Strona rankingu - liczy 3 kolumny punktów per user:
//   bonus_points - SUM(points) z bonus_answers,
//   match_points - SUM(points) z predictions,
//   total_points - suma obu.
// Sort malejąco po total_points, drugorzędnie po match_points.
//
// Robimy to po stronie JS - 3 osobne SELECT-y i merge - bo Supabase JS
// nie pozwala wygodnie na agregację po user_id w jednym zapytaniu bez
// rzeźbienia widoku w SQL. Dla setek userów to spokojnie wystarczy.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TabelaRankingu from '@/components/TabelaRankingu';

export default async function RankingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/logowanie');

  // Sprawdzamy is_admin aktualnego usera - admin widzi nawet ukryte boty,
  // żeby ranking u niego pokazywał pełny stan systemu.
  const { data: jaProfil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  const jestAdmin = !!jaProfil?.is_admin;

  let profileQuery = supabase.from('profiles').select('id, nick, is_bot, bot_ukryty');
  // Dla nie-adminów filtrujemy ukryte boty od razu na bazie - inaczej
  // wpadałyby do liczonych sum i numeracji.
  if (!jestAdmin) {
    profileQuery = profileQuery.eq('bot_ukryty', false);
  }

  const [{ data: profile }, { data: bonusy }, { data: mecze }] = await Promise.all([
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
  for (const m of mecze || []) {
    if (m.points == null) continue;
    sumaMecze.set(m.user_id, (sumaMecze.get(m.user_id) || 0) + m.points);
  }

  // Sortujemy tu, ale POZYCJĘ wylicza już TabelaRankingu (client) - po
  // ewentualnym odfiltrowaniu botów numeracja musi być ciągła.
  const wiersze = (profile || [])
    .map((p) => {
      const bonus_points = sumaBonus.get(p.id) || 0;
      const match_points = sumaMecze.get(p.id) || 0;
      return {
        user_id: p.id,
        nick: p.nick,
        is_bot: !!p.is_bot,
        bonus_points,
        match_points,
        total_points: bonus_points + match_points,
      };
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.match_points - a.match_points;
    });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Ranking</h1>
      <TabelaRankingu wiersze={wiersze} aktualnyUserId={user.id} />
    </main>
  );
}

// Strona admina do wpisania (lub korekty) wyniku końcowego meczu.
// Po zapisaniu wynik zostaje w matches, a Server Action od razu
// przelicza punkty wszystkich userów (predictions.points).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sprawdzAdmina } from '@/lib/admin';
import { formatujDateKrotkoPL } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import FormularzWyniku from './FormularzWyniku';

export default async function WynikMeczuPage({ params }) {
  const auth = await sprawdzAdmina();
  if (auth.error) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {auth.error}
        </p>
      </main>
    );
  }

  const { id } = await params;
  const meczId = Number(id);
  if (!meczId) notFound();

  const supabase = await createClient();
  const { data: mecz } = await supabase
    .from('matches')
    .select(
      `
        id, kickoff_at, status, home_score, away_score,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `,
    )
    .eq('id', meczId)
    .single();

  if (!mecz) notFound();

  // Liczba typów do rozliczenia - tylko head:true + count, bez pobierania danych.
  const { count: liczbaTypow } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', meczId);

  const home = mecz.home_team?.name || `#${mecz.home_team_id}`;
  const away = mecz.away_team?.name || `#${mecz.away_team_id}`;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <div className="mb-2">
        <Link
          href="/admin/mecze"
          className="text-sm text-emerald-300 hover:text-emerald-200"
        >
          &larr; Wróć do listy
        </Link>
      </div>
      <h1 className="mb-2 text-3xl font-bold text-emerald-50">
        Wpisz wynik: {home} vs {away}
      </h1>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-emerald-200/70">
        <span>{formatujDateKrotkoPL(mecz.kickoff_at)}</span>
        <StatusBadge status={mecz.status} />
      </div>

      <FormularzWyniku
        matchId={mecz.id}
        startowyHome={mecz.home_score}
        startowyAway={mecz.away_score}
      />

      <p className="mt-4 text-sm text-emerald-200/70">
        Liczba typów do rozliczenia:{' '}
        <span className="font-semibold text-emerald-100">{liczbaTypow ?? 0}</span>
      </p>
    </main>
  );
}

// Edycja meczu - dostępna tylko PRZED kickoff_at i tylko dla status='scheduled'.
// Po starcie meczu pokazujemy info i przycisk powrotu.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import FormularzMeczu from '../../FormularzMeczu';
import { edytujMecz } from '@/app/akcje/mecze';
import { dateDoYmdPL, dateDoHmPL, formatujDatePL } from '@/lib/format';
import Button from '@/components/Button';

export default async function EdycjaMeczuPage({ params }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: mecz } = await supabase
    .from('matches')
    .select(
      `
        id, kickoff_at, status, home_team_id, away_team_id,
        home_team:home_team_id ( name ),
        away_team:away_team_id ( name )
      `,
    )
    .eq('id', id)
    .single();

  if (!mecz) notFound();

  const teraz = new Date();
  const start = new Date(mecz.kickoff_at);
  const zablokowany = mecz.status !== 'scheduled' || start <= teraz;

  if (zablokowany) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <h1 className="mb-3 text-3xl font-bold text-emerald-50">Edycja meczu</h1>
        <p className="mb-4 text-emerald-200/80">
          {mecz.home_team?.name} vs {mecz.away_team?.name}
          <br />
          <span className="text-sm">Start: {formatujDatePL(mecz.kickoff_at)}</span>
        </p>
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Mecz już się rozpoczął lub został rozegrany — edycja zablokowana.
        </p>
        <Link href="/admin/mecze">
          <Button variant="secondary">Wróć do listy</Button>
        </Link>
      </main>
    );
  }

  const { data: druzyny } = await supabase
    .from('teams')
    .select('id, name')
    .order('name');

  const akcja = edytujMecz.bind(null, mecz.id);
  const defaultValues = {
    home_team_id: mecz.home_team_id,
    away_team_id: mecz.away_team_id,
    kickoff_date: dateDoYmdPL(mecz.kickoff_at),
    kickoff_time: dateDoHmPL(mecz.kickoff_at),
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Edycja meczu</h1>
      <FormularzMeczu akcja={akcja} druzyny={druzyny || []} defaultValues={defaultValues} />
    </main>
  );
}

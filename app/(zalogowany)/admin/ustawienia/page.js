// Ustawienia turnieju - aktualizuje jednowierszowy tournament_settings (id=1).
// Daty są w bazie w UTC (timestamptz), a w formularzu wyświetlamy je w PL.

import { createClient } from '@/lib/supabase/server';
import FormularzUstawien from './FormularzUstawien';
import { aktualizujUstawienia } from '@/app/akcje/ustawienia';
import { dateDoStrefyPolska } from '@/lib/format';

export default async function UstawieniaPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('tournament_settings')
    .select('*')
    .eq('id', 1)
    .single();

  const defaultValues = settings
    ? {
        tournament_name: settings.tournament_name,
        bonuses_close_at: dateDoStrefyPolska(settings.bonuses_close_at),
        tournament_starts_at: dateDoStrefyPolska(settings.tournament_starts_at),
      }
    : {};

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-emerald-50">Ustawienia turnieju</h1>
      <p className="mb-6 text-sm text-emerald-200/70">
        Daty wpisuj w czasie polskim (CET/CEST). System sam zamieni je na UTC do bazy.
      </p>
      <FormularzUstawien akcja={aktualizujUstawienia} defaultValues={defaultValues} />
    </main>
  );
}

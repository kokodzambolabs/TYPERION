import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import FormularzMeczu from '../FormularzMeczu';
import { dodajMecz } from '@/app/akcje/mecze';

export default async function NowyMeczPage() {
  const supabase = await createClient();
  const { data: druzyny } = await supabase
    .from('teams')
    .select('id, name')
    .order('name');

  // Bez 2 drużyn nie da się utworzyć meczu - pokazujemy podpowiedź.
  if (!druzyny || druzyny.length < 2) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <h1 className="mb-4 text-3xl font-bold text-emerald-50">Nowy mecz</h1>
        <p className="rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Musisz mieć co najmniej dwie drużyny w bazie.{' '}
          <Link
            href="/admin/druzyny/nowa"
            className="font-semibold text-amber-200 underline"
          >
            Dodaj drużyny
          </Link>{' '}
          najpierw.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Nowy mecz</h1>
      <FormularzMeczu akcja={dodajMecz} druzyny={druzyny} />
    </main>
  );
}

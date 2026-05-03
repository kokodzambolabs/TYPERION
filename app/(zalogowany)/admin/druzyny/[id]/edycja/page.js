import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FormularzDruzyny from '../../FormularzDruzyny';
import { edytujDruzyne } from '@/app/akcje/druzyny';

export default async function EdycjaDruzynyPage({ params }) {
  // params jest Promise w Next.js 16 - musimy poczekać.
  const { id } = await params;

  const supabase = await createClient();
  const { data: druzyna } = await supabase
    .from('teams')
    .select('id, name')
    .eq('id', id)
    .single();

  if (!druzyna) notFound();

  const akcja = edytujDruzyne.bind(null, druzyna.id);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Edycja drużyny</h1>
      <FormularzDruzyny akcja={akcja} defaultValues={druzyna} />
    </main>
  );
}

// Formularz nowego pytania - default order_index = max+1 z bazy.

import { createClient } from '@/lib/supabase/server';
import FormularzPytania from '../FormularzPytania';
import { dodajPytanie } from '@/app/akcje/bonusy';

export default async function NowePytaniePage() {
  const supabase = await createClient();
  const { data: ostatnie } = await supabase
    .from('bonus_questions')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1);

  const nastepnyOrder = (ostatnie?.[0]?.order_index ?? -1) + 1;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Nowe pytanie bonusowe</h1>
      <FormularzPytania
        akcja={dodajPytanie}
        defaultValues={{ order_index: nastepnyOrder }}
      />
    </main>
  );
}

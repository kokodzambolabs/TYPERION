// Tłumaczenie nazw reprezentacji narodowych z angielskiego (importowane
// z Football-Data.org) na polski wg słownika TLUMACZENIA_PL_EN.
//
// Server Component - dzieli drużyny na dwie sekcje:
//   - REPREZENTACJE DO PRZETŁUMACZENIA: nazwa istnieje jako wartość
//     w słowniku → proponujemy klucz polski (reverse lookup).
//   - KLUBY POMIJANE: brak w słowniku → tylko informacyjnie.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { przetlumaczNaPolski } from '@/lib/translateTeams';
import Button from '@/components/Button';
import KomponentTlumaczenia from './KomponentTlumaczenia';

export default async function TlumaczeniaPage() {
  const supabase = await createClient();
  const { data: druzyny, error } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .order('name', { ascending: true });

  const reprezentacje = [];
  const kluby = [];
  for (const d of druzyny || []) {
    const polska = przetlumaczNaPolski(d.name);
    if (polska && polska !== d.name) {
      reprezentacje.push({
        id: d.id,
        currentName: d.name,
        proposedName: polska,
      });
    } else {
      kluby.push({ id: d.id, name: d.name });
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">
            🇵🇱 Tłumacz nazwy reprezentacji
          </h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Zmień angielskie nazwy reprezentacji na polskie wg słownika{' '}
            <code className="text-emerald-100">TLUMACZENIA_PL_EN</code>.
            Kluby zostają bez zmian.
          </p>
        </div>
        <Link href="/admin/druzyny">
          <Button variant="secondary">← Wróć do drużyn</Button>
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          Błąd ładowania drużyn: {error.message}
        </p>
      )}

      <KomponentTlumaczenia reprezentacje={reprezentacje} kluby={kluby} />
    </main>
  );
}

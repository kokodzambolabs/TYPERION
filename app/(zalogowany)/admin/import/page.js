// Strona importu meczów z Football-Data.org.
// Server Component - pobiera liczniki (mecze w bazie, drużyny w bazie,
// drużyny zmapowane do API) i renderuje panel client-side, który
// wywołuje Server Action importujMecze.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/Button';
import PanelImportu from './PanelImportu';

export default async function ImportPage() {
  const supabase = await createClient();

  // Trzy liczniki w jednym round-tripie. count(head: true) - bez pobierania wierszy.
  const [meczeResp, druzynyResp, druzynyZmapowaneResp] = await Promise.all([
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    supabase.from('teams').select('id', { count: 'exact', head: true }),
    supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .not('external_id', 'is', null),
  ]);

  const meczeCount = meczeResp.count ?? 0;
  const druzynyCount = druzynyResp.count ?? 0;
  const druzynyZmapowane = druzynyZmapowaneResp.count ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">Import meczów</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Pobierz harmonogram meczów z Football-Data.org i dodaj brakujące do bazy.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">← Wróć do panelu</Button>
        </Link>
      </div>

      <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
        ℹ️ Drużyny muszą być zmapowane do API zanim zaimportujesz mecze.
        Niezmapowane mecze zostaną pominięte. Mapowanie:{' '}
        <Link
          href="/admin/druzyny/mapowanie"
          className="font-semibold text-amber-200 underline hover:text-amber-100"
        >
          /admin/druzyny/mapowanie
        </Link>
        .
      </div>

      <PanelImportu
        meczeCount={meczeCount}
        druzynyCount={druzynyCount}
        druzynyZmapowane={druzynyZmapowane}
      />
    </main>
  );
}

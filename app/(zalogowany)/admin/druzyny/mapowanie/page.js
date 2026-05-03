// Mapowanie naszych drużyn na drużyny w Football-Data.org.
// Server Component:
//   - pobiera nasze drużyny z bazy,
//   - pobiera drużyny z API (cache 30s w lib/footballData),
//   - renderuje formularz z bulk save.
// Bez API (brak klucza, rate limit, błąd) strona dalej działa - admin
// widzi komunikat błędu zamiast listy z API i może wrócić.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { pobierzZespoly } from '@/lib/footballData';
import Button from '@/components/Button';
import FormularzMapowaniaDruzyn from './FormularzMapowaniaDruzyn';

export default async function MapowanieDruzynPage() {
  const supabase = await createClient();

  const [druzynyResp, apiResp] = await Promise.all([
    supabase.from('teams').select('id, name, external_id').order('name'),
    pobierzZespoly('WC'),
  ]);

  const druzyny = druzynyResp.data || [];
  const apiOk = apiResp.success;
  const apiDruzyny = apiOk ? apiResp.data : [];
  const bladApi = apiOk ? null : apiResp.error;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">Mapowanie drużyn → API</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Football-Data.org: competition WC (Mistrzostwa Świata).
          </p>
        </div>
        <Link href="/admin/druzyny">
          <Button variant="secondary">← Wróć do drużyn</Button>
        </Link>
      </div>

      {bladApi && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          Nie udało się pobrać drużyn z Football-Data.org: {bladApi}
        </div>
      )}

      {druzyny.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak drużyn w bazie. Najpierw dodaj drużyny pod{' '}
          <Link href="/admin/druzyny" className="text-emerald-300 underline hover:text-emerald-200">
            /admin/druzyny
          </Link>.
        </div>
      ) : (
        <FormularzMapowaniaDruzyn druzyny={druzyny} apiDruzyny={apiDruzyny} apiOk={apiOk} />
      )}
    </main>
  );
}

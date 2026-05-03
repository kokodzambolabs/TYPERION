// Auto-mapowanie niezmapowanych drużyn (external_id IS NULL) do drużyn
// z Football-Data.org. Server Component:
//   - pobiera niezmapowane drużyny i listę z API,
//   - dla każdej liczy dopasowDruzyne() (server-side, raz),
//   - przekazuje gotowe dopasowania do client component.
//
// Selector competycji (WC/CL/PL/...) trzymany w query param ?competition=...
// Przeładowanie strony przy zmianie - dzięki czemu klient nie musi
// odpalać API w przeglądarce.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { pobierzZespoly } from '@/lib/footballData';
import { dopasowDruzyne } from '@/lib/fuzzyMatch';
import { DOZWOLONE_COMPETITIONS, NAZWY_COMPETITIONS } from '@/lib/competitions';
import Button from '@/components/Button';
import KomponentAutoMapowania from './KomponentAutoMapowania';
import SelektorCompetycji from './SelektorCompetycji';

export default async function AutoMapowaniePage({ searchParams }) {
  const sp = (await searchParams) || {};
  const competition = DOZWOLONE_COMPETITIONS.includes(sp.competition)
    ? sp.competition
    : 'WC';

  const supabase = await createClient();

  const [druzynyResp, apiResp] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, external_id')
      .is('external_id', null)
      .order('name'),
    pobierzZespoly(competition),
  ]);

  const druzyny = druzynyResp.data || [];
  const apiOk = apiResp.success;
  const apiDruzyny = apiOk ? apiResp.data : [];
  const bladApi = apiOk ? null : apiResp.error;

  // Wyrzucamy z listy API drużyny już zajęte (ktoś zmapował innego team-a
  // na ten external_id), żeby nie pokazywać ich jako sugestii.
  const { data: zajete } = await supabase
    .from('teams')
    .select('external_id')
    .not('external_id', 'is', null);
  const zajeteIds = new Set((zajete || []).map((t) => t.external_id));
  const wolneApiDruzyny = apiDruzyny.filter((a) => !zajeteIds.has(a.id));

  // Liczymy dopasowania na serwerze - klient dostaje gotowy wynik bez
  // robienia O(N*M) w przeglądarce.
  const dopasowania = druzyny.map((d) => ({
    druzyna: { id: d.id, name: d.name },
    wynik: dopasowDruzyne(d.name, wolneApiDruzyny),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">Auto-mapowanie drużyn</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Mapowanie niezmapowanych drużyn do Football-Data.org -
            słownik dla reprezentacji + fuzzy matching dla klubów.
          </p>
        </div>
        <Link href="/admin/druzyny">
          <Button variant="secondary">← Wróć do drużyn</Button>
        </Link>
      </div>

      <SelektorCompetycji
        competition={competition}
        opcje={DOZWOLONE_COMPETITIONS.map((kod) => ({
          kod,
          nazwa: NAZWY_COMPETITIONS[kod] || kod,
        }))}
      />

      {bladApi && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          Nie udało się pobrać drużyn z Football-Data.org: {bladApi}
        </div>
      )}

      {druzyny.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Wszystkie drużyny w bazie mają już <code>external_id</code> -
          nie ma czego mapować. ✅
        </div>
      ) : !apiOk ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak danych z API - napraw klucz/limit i odśwież stronę.
        </div>
      ) : (
        <KomponentAutoMapowania
          dopasowania={dopasowania}
          apiDruzyny={wolneApiDruzyny}
          competition={competition}
        />
      )}
    </main>
  );
}

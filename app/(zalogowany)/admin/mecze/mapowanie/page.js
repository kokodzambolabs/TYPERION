// Mapowanie naszych meczów na mecze w Football-Data.org.
// Server Component:
//   - pobiera nasze NIEZMAPOWANE mecze (external_id IS NULL),
//   - pobiera mecze z API (cache 30s),
//   - próbuje auto-match po external_id obu drużyn + dacie (<= 1h różnicy),
//   - wynik (auto-sugestia + edytowalny select) renderuje formularz client.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { pobierzMecze } from '@/lib/footballData';
import Button from '@/components/Button';
import FormularzMapowaniaMeczow from './FormularzMapowaniaMeczow';

const GODZINA_MS = 60 * 60 * 1000;

// Dla pojedynczego naszego meczu szuka kandydata w API:
//   - obie drużyny zmapowane (home/away.external_id != null),
//   - api.homeTeam.id == naszHome.external_id, api.awayTeam.id == naszAway.external_id,
//   - |kickoff - utcDate| <= 1h.
// Jeśli unikalny kandydat - zwraca jego id; w przeciwnym razie null.
function autoSugestia(naszMecz, apiMecze) {
  const homeExt = naszMecz.home_team?.external_id;
  const awayExt = naszMecz.away_team?.external_id;
  if (homeExt == null || awayExt == null) return null;

  const t = new Date(naszMecz.kickoff_at).getTime();
  const kandydaci = apiMecze.filter((a) => {
    if (a.homeTeam?.id !== homeExt) return false;
    if (a.awayTeam?.id !== awayExt) return false;
    const tApi = new Date(a.utcDate).getTime();
    return Math.abs(tApi - t) <= GODZINA_MS;
  });
  return kandydaci.length === 1 ? kandydaci[0].id : null;
}

export default async function MapowanieMeczowPage() {
  const supabase = await createClient();

  const [meczeResp, apiResp] = await Promise.all([
    supabase
      .from('matches')
      .select(
        `
          id, kickoff_at, external_id, status,
          home_team:home_team_id ( id, name, external_id ),
          away_team:away_team_id ( id, name, external_id )
        `,
      )
      .is('external_id', null)
      .order('kickoff_at', { ascending: true }),
    pobierzMecze('WC'),
  ]);

  const mecze = meczeResp.data || [];
  const apiOk = apiResp.success;
  const apiMecze = apiOk ? apiResp.data : [];
  const bladApi = apiOk ? null : apiResp.error;

  // Auto-sugestie liczone na serwerze - klient dostaje gotowe defaultValues.
  const sugestie = {};
  for (const m of mecze) {
    sugestie[m.id] = apiOk ? autoSugestia(m, apiMecze) : null;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">Mapowanie meczów → API</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Pokazujemy tylko mecze, które jeszcze nie mają external_id.
            Auto-sugestia wymaga zmapowanych obu drużyn (external_id w teams).
          </p>
        </div>
        <Link href="/admin/mecze">
          <Button variant="secondary">← Wróć do meczów</Button>
        </Link>
      </div>

      {bladApi && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          Nie udało się pobrać meczów z Football-Data.org: {bladApi}
        </div>
      )}

      {mecze.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Wszystkie mecze są już zmapowane (lub nie ma żadnych meczów).
        </div>
      ) : (
        <FormularzMapowaniaMeczow
          mecze={mecze}
          apiMecze={apiMecze}
          sugestie={sugestie}
          apiOk={apiOk}
        />
      )}
    </main>
  );
}

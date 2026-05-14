// API Route - cron typujący mecze przez boty AI.
// Wywoływany zewnętrznie (np. cron-job.org) co godzinę. Bierze mecze
// startujące w oknie 0-120 min i dla każdej pary aktywny_bot × mecz
// (gdzie bot jeszcze nie typował) wysyła osobne POST do endpointa
// /api/generuj-typ-pojedynczy w trybie fire-and-forget. Sam cron ma
// więc tylko zlecić zadania - nie czeka aż boty skończą.
//
// Autoryzacja: nagłówek Authorization: Bearer ${CRON_SECRET} (ten sam
// sekret co cron aktualizacji wyników).
//
// maxDuration=60 wystarcza, bo cron tylko zleca - prawdziwe typowanie
// dzieje się w endpointcie pojedynczego typu (każdy z własnym 300s budżetem).

import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { uruchomCronBotow } from '@/lib/ai-typer/cronBotow';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  const oczekiwany = process.env.CRON_SECRET;
  if (!oczekiwany) {
    console.error('[cron-boty] brak CRON_SECRET w env - cron zablokowany');
    return Response.json(
      { ok: false, error: 'Brak CRON_SECRET w env.' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${oczekiwany}`) {
    console.warn('[cron-boty] nieautoryzowane wywołanie /api/cron/boty-ai');
    return Response.json(
      { ok: false, error: 'Brak autoryzacji.' },
      { status: 401 },
    );
  }

  let sb;
  try {
    sb = utworzKlientaServiceRole();
  } catch (e) {
    console.error('[cron-boty] inicjalizacja klienta service_role:', e?.message);
    return Response.json(
      { ok: false, error: e?.message || 'Błąd klienta Supabase.' },
      { status: 500 },
    );
  }

  // Self-callback do /api/generuj-typ-pojedynczy potrzebuje absolutnego URL.
  // Na Vercel host przychodzi przez x-forwarded-host, schemat przez x-forwarded-proto.
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const start = Date.now();
  const wynik = await uruchomCronBotow(sb, { baseUrl });
  const ms = Date.now() - start;

  console.log(
    `[cron-boty] zakończone w ${ms}ms - zlecone=${wynik.zlecone ?? 0}, ` +
      `skipped=${wynik.skipped ?? 0}, mecze=${wynik.total_matches ?? 0}, ` +
      `boty=${wynik.total_bots ?? 0}`,
  );

  if (!wynik.ok) {
    return Response.json({ ...wynik, ms }, { status: 500 });
  }
  return Response.json({ ...wynik, ms });
}

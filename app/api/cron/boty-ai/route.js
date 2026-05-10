// API Route - cron typujący mecze przez boty AI.
// Wywoływany zewnętrznie (np. cron-job.org) co godzinę. Bierze mecze
// startujące za 60-90 min i odpala każdego AKTYWNEGO bota na każdym z nich.
// Boty, które już typowały dany mecz, są pomijane (idempotentne).
//
// Autoryzacja: nagłówek Authorization: Bearer ${CRON_SECRET} (ten sam
// sekret co cron aktualizacji wyników).
//
// Całą logikę dzielimy z Server Action wymusGenerowanieBotow() przez
// lib/ai-typer/cronBotow.js - tu zostaje tylko autoryzacja i init klienta.

import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { uruchomCronBotow } from '@/lib/ai-typer/cronBotow';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const oczekiwany = process.env.CRON_SECRET;
  if (!oczekiwany) {
    console.error('[cron-boty] brak CRON_SECRET w env - cron zablokowany');
    return Response.json({ ok: false, error: 'Brak CRON_SECRET w env.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${oczekiwany}`) {
    console.warn('[cron-boty] nieautoryzowane wywołanie /api/cron/boty-ai');
    return Response.json({ ok: false, error: 'Brak autoryzacji.' }, { status: 401 });
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

  const start = Date.now();
  const wynik = await uruchomCronBotow(sb);
  const ms = Date.now() - start;

  console.log(
    `[cron-boty] zakończone w ${ms}ms - processed=${wynik.processed ?? 0}, ` +
      `errors=${wynik.errors ?? 0}, skipped=${wynik.skipped ?? 0}`,
  );

  if (!wynik.ok) {
    return Response.json({ ...wynik, ms }, { status: 500 });
  }
  return Response.json({ ...wynik, ms });
}

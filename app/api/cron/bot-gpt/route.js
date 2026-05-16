// API Route - cron typujący mecze przez bota ChatGPT casual (GPT-5-mini).
// Odpalany 3h przed meczem (okno 150-240 min) - bot jest baseline'em
// do wykrywania userów kopiujących typy z ChatGPT, więc musi typować
// znacznie wcześniej niż wszyscy inni (osobny cron, osobne okno).
//
// Tożsama mechanika co /api/cron/boty-ai - after()/waitUntil, fire-and-forget
// do /api/generuj-typ-pojedynczy, ten sam CRON_SECRET. Różnica wyłącznie
// w filtrze providera (włącza tylko 'openai') i oknie czasowym.

import { after } from 'next/server';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { uruchomCronBotow } from '@/lib/ai-typer/cronBotow';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const OKNO_OD_MIN = 150;
const OKNO_DO_MIN = 240;

export async function GET(request) {
  const oczekiwany = process.env.CRON_SECRET;
  if (!oczekiwany) {
    console.error('[cron-bot-gpt] brak CRON_SECRET w env - cron zablokowany');
    return Response.json(
      { ok: false, error: 'Brak CRON_SECRET w env.' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${oczekiwany}`) {
    console.warn('[cron-bot-gpt] nieautoryzowane wywołanie /api/cron/bot-gpt');
    return Response.json(
      { ok: false, error: 'Brak autoryzacji.' },
      { status: 401 },
    );
  }

  let sb;
  try {
    sb = utworzKlientaServiceRole();
  } catch (e) {
    console.error('[cron-bot-gpt] inicjalizacja klienta service_role:', e?.message);
    return Response.json(
      { ok: false, error: e?.message || 'Błąd klienta Supabase.' },
      { status: 500 },
    );
  }

  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const start = Date.now();
  console.log(`[cron-bot-gpt] start baseUrl=${baseUrl}`);

  after(async () => {
    try {
      const wynik = await uruchomCronBotow(sb, {
        baseUrl,
        oknoOdMin: OKNO_OD_MIN,
        oknoDoMin: OKNO_DO_MIN,
        includeProviders: ['openai'],
      });
      const ms = Date.now() - start;
      console.log(
        `[cron-bot-gpt] (after) zakończone w ${ms}ms - ` +
          `ok=${wynik.ok} zlecone=${wynik.zlecone ?? 0} ` +
          `sukcesy=${wynik.sukcesy ?? 0} bledy=${wynik.bledy ?? 0} ` +
          `skipped=${wynik.skipped ?? 0} mecze=${wynik.total_matches ?? 0} ` +
          `boty=${wynik.total_bots ?? 0}` +
          (wynik.error ? ` error=${wynik.error}` : ''),
      );
    } catch (e) {
      const ms = Date.now() - start;
      console.error(
        `[cron-bot-gpt] (after) wyjątek po ${ms}ms: ${e?.message}`,
        e?.stack,
      );
    }
  });

  return Response.json({
    ok: true,
    message:
      'Cron bot-gpt przyjęty - dispatch leci w tle (after/waitUntil). ' +
      'Wyniki sprawdź w /admin/boty-ai/logi za 1-3 minuty.',
  });
}

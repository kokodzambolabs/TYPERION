// API Route - cron typujący mecze przez boty AI.
// Wywoływany zewnętrznie (cron-job.org) co godzinę. Bierze mecze
// startujące w oknie 0-120 min i dla każdej pary aktywny_bot × mecz
// (gdzie bot jeszcze nie typował) wysyła osobne POST do
// /api/generuj-typ-pojedynczy. Sam cron zwraca 200 natychmiast - faktyczna
// praca leci w tle przez Next.js after() / Vercel waitUntil, czyli
// kontener serverless żyje aż wszystkie child fetche wrócą (do maxDuration).
//
// Autoryzacja: nagłówek Authorization: Bearer ${CRON_SECRET}.
//
// Dlaczego after() a nie zwykły await:
//   - cron-job.org dostaje 200 od razu, nie ma ryzyka że timeoutuje po
//     swojej stronie (niektóre runy crona mogły wypadać z tego powodu).
//   - Vercel rozszerza lifetime kontenera o czas trwania callbacka after(),
//     więc nawet jak coś trwa 200s, kontener nie zostanie zamrożony.
//   - Bez after() / waitUntil "fire-and-forget" (fetch bez await) ginie
//     w połowie, bo Vercel mrozi kontener tuż po Response.

import { after } from 'next/server';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { uruchomCronBotow } from '@/lib/ai-typer/cronBotow';

export const dynamic = 'force-dynamic';
// 300s = max na Vercel Hobby. Tyle ma czasu after() (waitUntil) na
// dispatch wszystkich child requestów i zebranie ich odpowiedzi.
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
  console.log(`[cron-boty] start baseUrl=${baseUrl}`);

  // Praca w tle - Vercel waitUntil trzyma kontener aż callback się skończy.
  // Logi z after() lecą do Vercel Functions logs.
  // Pomijamy ai_provider='openai' - bot ChatGPT casual ma własny cron
  // (/api/cron/bot-gpt, 150-240 min przed meczem) i nie chcemy go
  // tu odpalać po raz drugi w innym oknie.
  after(async () => {
    try {
      const wynik = await uruchomCronBotow(sb, {
        baseUrl,
        excludeProviders: ['openai'],
      });
      const ms = Date.now() - start;
      console.log(
        `[cron-boty] (after) zakończone w ${ms}ms - ` +
          `ok=${wynik.ok} zlecone=${wynik.zlecone ?? 0} ` +
          `sukcesy=${wynik.sukcesy ?? 0} bledy=${wynik.bledy ?? 0} ` +
          `skipped=${wynik.skipped ?? 0} mecze=${wynik.total_matches ?? 0} ` +
          `boty=${wynik.total_bots ?? 0}` +
          (wynik.error ? ` error=${wynik.error}` : ''),
      );
    } catch (e) {
      const ms = Date.now() - start;
      console.error(
        `[cron-boty] (after) wyjątek po ${ms}ms: ${e?.message}`,
        e?.stack,
      );
    }
  });

  return Response.json({
    ok: true,
    message:
      'Cron przyjęty - dispatch botów leci w tle (after/waitUntil). ' +
      'Wyniki sprawdź w /admin/boty-ai/logi za 1-3 minuty.',
  });
}

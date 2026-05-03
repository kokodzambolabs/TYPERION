// API Route - cron pobierający wyniki z Football-Data.org.
// Vercel Cron uderza tu zgodnie z harmonogramem z vercel.json
// (domyślnie co 10 minut). Endpoint dostępny też ręcznie - kluczowe
// jest wymaganie nagłówka Authorization: Bearer ${CRON_SECRET}.
//
// Logika aktualizacji jest w lib/aktualizator.js - dzieli ją z
// Server Action recznieAktualizujWyniki w app/akcje/api.js.

import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { aktualizujWynikiCore } from '@/lib/aktualizator';

// Wyłączamy ewentualny cache GET-a w Route Handlerze - cron MUSI
// poleciec do bazy i API za każdym wywołaniem.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Vercel Cron przesyła Authorization: Bearer ${CRON_SECRET} automatycznie,
  // jeśli zmienna CRON_SECRET jest ustawiona w projekcie. Lokalnie/ręcznie
  // wystarczy wysłać ten sam header - przydatne do testów.
  const oczekiwany = process.env.CRON_SECRET;
  if (!oczekiwany) {
    console.error('[cron] brak CRON_SECRET w env - cron zablokowany');
    return Response.json(
      { ok: false, error: 'Brak CRON_SECRET w env.' },
      { status: 500 },
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${oczekiwany}`) {
    console.warn('[cron] nieautoryzowane wywołanie /api/cron/aktualizuj-wyniki');
    return Response.json({ ok: false, error: 'Brak autoryzacji.' }, { status: 401 });
  }

  // Klient service_role - omija RLS, bo cron nie ma sesji usera.
  let supabase;
  try {
    supabase = utworzKlientaServiceRole();
  } catch (e) {
    console.error('[cron] inicjalizacja klienta service_role:', e?.message);
    return Response.json(
      { ok: false, error: e?.message || 'Błąd klienta Supabase.' },
      { status: 500 },
    );
  }

  const start = Date.now();
  const wynik = await aktualizujWynikiCore(supabase);
  const ms = Date.now() - start;

  console.log(
    `[cron] zakończone w ${ms}ms - sprawdzonych=${wynik.sprawdzonych ?? 0}, ` +
      `zaktualizowanych=${wynik.zaktualizowanych ?? 0}, ` +
      `zakonczonych=${wynik.zakonczonych ?? 0}`,
  );

  if (wynik.error) {
    return Response.json(
      {
        ok: false,
        error: wynik.error,
        sprawdzonych: wynik.sprawdzonych ?? 0,
        zaktualizowanych: wynik.zaktualizowanych ?? 0,
        zakonczonych: wynik.zakonczonych ?? 0,
        ms,
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    message: wynik.ok,
    sprawdzonych: wynik.sprawdzonych,
    zaktualizowanych: wynik.zaktualizowanych,
    zakonczonych: wynik.zakonczonych,
    ms,
  });
}

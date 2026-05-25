// Rdzeń aktualizacji wyników - DZIELONY między:
//   - Server Action recznieAktualizujWyniki (admin klika "Odśwież teraz"),
//   - cron API route /api/cron/aktualizuj-wyniki (Vercel Cron co 10 min).
//
// Funkcja przyjmuje gotowy klient Supabase z odpowiednimi uprawnieniami:
//   - sesja admina (z cookies w Server Action),
//   - lub klient service_role (w cronie - omija RLS).
// Uprawnienia są zweryfikowane PRZED wywołaniem - tu już ufamy klientowi.
//
// Plik nie ma 'use server' - to zwykły moduł lib, można importować
// z dowolnego miejsca po stronie serwera (Server Action, Route Handler).

import { revalidatePath } from 'next/cache';
import { pobierzMeczePoIds, statusZApi } from '@/lib/footballData';
import { policzPunktyMeczu } from '@/lib/punktacja';
import { czyPucharowy } from '@/lib/helpers/etapMeczu';

// Główny task: przelatuje mecze, które:
//   - mają external_id (są zmapowane na API),
//   - nie są jeszcze 'finished',
//   - kickoff_at już minął (powinny być w trakcie albo po).
// Dla każdego porównuje stan z API i ewentualnie zapisuje wynik.
// Mecze, które przejdą na 'finished', dostają od razu rozliczenie typów
// (predictions.points wpisane przez policzPunkty z lib/punktacja).
//
// Pytamy Football-Data po /v4/matches?ids= zamiast osobno per competycja -
// dzięki temu działa dla wszystkich rozgrywek, których mecze admin
// zaimportował (WC, PL, CL, ...).
//
// Zwraca: { ok | error, sprawdzonych, zaktualizowanych, zakonczonych }.
export async function aktualizujWynikiCore(supabase) {
  const teraz = new Date().toISOString();

  const { data: mecze, error: meczeE } = await supabase
    .from('matches')
    .select('id, external_id, status, kickoff_at, home_score, away_score, group_name, home_team_id, away_team_id')
    .not('external_id', 'is', null)
    .neq('status', 'finished')
    .lte('kickoff_at', teraz);
  if (meczeE) {
    console.error('[aktualizator] błąd pobrania meczów z bazy:', meczeE.message);
    return { error: meczeE.message, sprawdzonych: 0, zaktualizowanych: 0, zakonczonych: 0 };
  }

  if (!mecze || mecze.length === 0) {
    console.log('[aktualizator] brak meczów do aktualizacji');
    return { ok: 'Brak meczów do aktualizacji.', sprawdzonych: 0, zaktualizowanych: 0, zakonczonych: 0 };
  }

  console.log(`[aktualizator] sprawdzam ${mecze.length} meczów`);

  const externalIds = mecze.map((m) => m.external_id);
  const apiResp = await pobierzMeczePoIds(externalIds);
  if (!apiResp.success) {
    console.error('[aktualizator] API:', apiResp.error);
    return { error: apiResp.error, sprawdzonych: 0, zaktualizowanych: 0, zakonczonych: 0 };
  }
  const apiPoId = new Map((apiResp.data || []).map((m) => [m.id, m]));

  let zaktualizowane = 0;
  let zakonczone = 0;

  for (const mecz of mecze) {
    const apiMecz = apiPoId.get(mecz.external_id);

    // api_last_check ustawiamy NIEZALEŻNIE od tego, czy mecz znaleźliśmy.
    // Dzięki temu w bazie widać "kiedy ostatnio próbowaliśmy" - przydatne
    // przy debugu (np. mecz nie spada do finished bo jego external_id
    // nie istnieje w API).
    const aktualizacja = { api_last_check: teraz };

    if (!apiMecz) {
      await supabase.from('matches').update(aktualizacja).eq('id', mecz.id);
      console.warn(
        `[aktualizator] mecz #${mecz.id} (external_id=${mecz.external_id}) nieznaleziony w API`,
      );
      continue;
    }

    const nowyStatus = statusZApi(apiMecz.status);
    const fullTimeHome = apiMecz.score?.fullTime?.home ?? null;
    const fullTimeAway = apiMecz.score?.fullTime?.away ?? null;
    const extraTimeHome = apiMecz.score?.extraTime?.home ?? null;
    const extraTimeAway = apiMecz.score?.extraTime?.away ?? null;

    // Wynik finalny: extraTime jeśli istnieje, else fullTime
    const finalHome = extraTimeHome != null ? extraTimeHome : fullTimeHome;
    const finalAway = extraTimeAway != null ? extraTimeAway : fullTimeAway;

    if (nowyStatus === 'finished' && fullTimeHome != null && fullTimeAway != null) {
      // Zawsze zapisujemy full_time_* (wynik 90min - używany dla pucharowych)
      aktualizacja.full_time_home_score = fullTimeHome;
      aktualizacja.full_time_away_score = fullTimeAway;
      // I wynik finalny do home/away_score
      aktualizacja.home_score = finalHome;
      aktualizacja.away_score = finalAway;
      aktualizacja.status = 'finished';

      // Dla pucharowych: mapuj score.winner na team_id
      if (czyPucharowy(mecz.group_name)) {
        const score = apiMecz.score?.winner;
        if (score === 'HOME_TEAM') {
          aktualizacja.winner_team_id = mecz.home_team_id;
        } else if (score === 'AWAY_TEAM') {
          aktualizacja.winner_team_id = mecz.away_team_id;
        } else if (score === 'DRAW') {
          aktualizacja.winner_team_id = null;
        }
      }
    } else if (nowyStatus === 'live') {
      // Bieżący wynik też zapisujemy - karta meczu pokazuje go na żywo (wynik 90min, jeśli dostępny)
      if (fullTimeHome != null) aktualizacja.home_score = fullTimeHome;
      if (fullTimeAway != null) aktualizacja.away_score = fullTimeAway;
      aktualizacja.status = 'live';
    }

    const { error: updE } = await supabase
      .from('matches')
      .update(aktualizacja)
      .eq('id', mecz.id);
    if (updE) {
      console.error(`[aktualizator] UPDATE #${mecz.id}:`, updE.message);
      continue;
    }

    if (aktualizacja.status === 'finished') {
      // Przygotuj pełny obiekt meczu z nowymi danymi dla rozliczenia
      const meczPelny = {
        ...mecz,
        ...aktualizacja, // include updated values
      };
      const rozliczenie = await przeliczTypyDlaMeczu(supabase, meczPelny);
      if (rozliczenie.error) {
        console.error(`[aktualizator] rozliczenie #${mecz.id}:`, rozliczenie.error);
      } else {
        console.log(
          `[aktualizator] mecz #${mecz.id} -> finished, rozliczono ${rozliczenie.ok} typów`,
        );
      }
      zakonczone += 1;
      zaktualizowane += 1;
    } else if (aktualizacja.status === 'live') {
      zaktualizowane += 1;
    }
  }

  // Odświeżamy strony, na których wynik się pokazuje. revalidatePath jest
  // bezpieczne do wywołania zarówno z Server Action, jak i z Route Handlera.
  revalidatePath('/mecze');
  revalidatePath('/admin/mecze');
  revalidatePath('/ranking');

  return {
    ok: `Sprawdzono ${mecze.length} meczów, zaktualizowano ${zaktualizowane}, zakończono ${zakonczone}.`,
    sprawdzonych: mecze.length,
    zaktualizowanych: zaktualizowane,
    zakonczonych: zakonczone,
  };
}

// Pomocnicza: rozliczenie predictions po wpisaniu wyniku meczu.
// Nie autoryzuje - liczy na to, że klient ma uprawnienia (admin lub service_role).
// Otrzymuje pełny obiekt meczu z aktualnymi danymi (home/away_score, full_time_*, winner_team_id).
async function przeliczTypyDlaMeczu(supabase, mecz) {
  const { data: typy, error } = await supabase
    .from('predictions')
    .select('id, home_score, away_score, winner_team_id')
    .eq('match_id', mecz.id);
  if (error) return { error: error.message };
  if (!typy || typy.length === 0) return { ok: 0 };

  const updates = typy.map((t) =>
    supabase
      .from('predictions')
      .update({
        points: policzPunktyMeczu({ home_score: t.home_score, away_score: t.away_score, winner_team_id: t.winner_team_id }, mecz),
      })
      .eq('id', t.id),
  );
  const wyniki = await Promise.all(updates);
  const blad = wyniki.find((r) => r.error);
  if (blad?.error) return { error: blad.error.message };
  return { ok: typy.length };
}

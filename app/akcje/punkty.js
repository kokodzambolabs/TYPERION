'use server';

// Server Actions Fazy 8 - liczenie punktów meczowych.
//
// 1) policzPunktyMeczu(matchId) - bierze wynik meczu z bazy i przelicza
//    points dla wszystkich predictions tego meczu. Idempotentne - można
//    wywołać wielokrotnie (np. po korekcie wyniku).
//
// 2) zapiszWynikIRozlicz(prevState, formData) - zapisuje wynik (matches)
//    + woła policzPunktyMeczu jednym ruchem. Wywoływane z formularza
//    /admin/mecze/[id]/wynik.
//
// RLS: zwykła polityka predictions_update_own_before_kickoff blokuje
// UPDATE po starcie meczu, więc do zapisu points dorzuciliśmy osobną
// politykę dla admina (patrz MIGRACJA_PUNKTY.sql).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { policzPunkty } from '@/lib/punktacja';

const SchematWyniku = z.object({
  matchId: z.coerce.number().int().positive({ message: 'Nieprawidłowy mecz.' }),
  homeScore: z.coerce
    .number()
    .int({ message: 'Wynik musi być liczbą całkowitą.' })
    .min(0, { message: 'Wynik nie może być ujemny.' })
    .max(20, { message: 'Wynik max 20.' }),
  awayScore: z.coerce
    .number()
    .int({ message: 'Wynik musi być liczbą całkowitą.' })
    .min(0, { message: 'Wynik nie może być ujemny.' })
    .max(20, { message: 'Wynik max 20.' }),
  finished: z.coerce.boolean().optional(),
});

// Liczy points dla wszystkich predictions powiązanych z meczem.
// Zwraca { ok: liczba_zaktualizowanych } albo { error: ... }.
export async function policzPunktyMeczu(matchId) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const id = Number(matchId);
  if (!id) return { error: 'Nieprawidłowy identyfikator meczu.' };

  const { data: mecz, error: meczE } = await auth.supabase
    .from('matches')
    .select('id, home_score, away_score')
    .eq('id', id)
    .single();
  if (meczE || !mecz) return { error: 'Mecz nie istnieje.' };
  if (mecz.home_score == null || mecz.away_score == null) {
    return { error: 'Mecz nie ma jeszcze wpisanego wyniku.' };
  }

  const { data: typy, error: typyE } = await auth.supabase
    .from('predictions')
    .select('id, home_score, away_score')
    .eq('match_id', id);
  if (typyE) return { error: typyE.message };

  if (!typy || typy.length === 0) {
    revalidatePath('/mecze');
    revalidatePath('/admin/mecze');
    revalidatePath('/ranking');
    return { ok: 0 };
  }

  const wynik = { home: mecz.home_score, away: mecz.away_score };

  // UPDATE pojedynczo - w Supabase nie ma czystego "bulk update z różnymi
  // wartościami per wiersz". Można by zrobić upsert całej listy z
  // onConflict, ale wtedy musielibyśmy podać user_id/match_id - bezpieczniej
  // walnąć N małych UPDATE-ów (transakcja każdy z osobna jest OK,
  // bo pole points to tylko wynik czystej funkcji punktacji).
  const updates = typy.map((t) => {
    const punkty = policzPunkty(
      { home: t.home_score, away: t.away_score },
      wynik,
    );
    return auth.supabase
      .from('predictions')
      .update({ points: punkty })
      .eq('id', t.id);
  });

  const wyniki = await Promise.all(updates);
  const blad = wyniki.find((r) => r.error);
  if (blad?.error) return { error: blad.error.message };

  revalidatePath('/mecze');
  revalidatePath('/admin/mecze');
  revalidatePath('/ranking');
  return { ok: typy.length };
}

export async function zapiszWynikIRozlicz(_prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = SchematWyniku.safeParse({
    matchId: formData.get('matchId'),
    homeScore: formData.get('homeScore'),
    awayScore: formData.get('awayScore'),
    finished: formData.get('finished'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { matchId, homeScore, awayScore, finished } = parsed.data;

  const { data: aktualny, error: aktualnyE } = await auth.supabase
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .single();
  if (aktualnyE || !aktualny) return { error: 'Mecz nie istnieje.' };

  const aktualizacja = {
    home_score: homeScore,
    away_score: awayScore,
  };
  if (finished) aktualizacja.status = 'finished';

  const { error: updE } = await auth.supabase
    .from('matches')
    .update(aktualizacja)
    .eq('id', matchId);
  if (updE) return { error: updE.message };

  const wynikRozliczenia = await policzPunktyMeczu(matchId);
  if (wynikRozliczenia?.error) return { error: wynikRozliczenia.error };

  revalidatePath('/mecze');
  revalidatePath('/admin/mecze');
  revalidatePath('/ranking');
  revalidatePath(`/admin/mecze/${matchId}/wynik`);
  redirect('/admin/mecze?status=wynik-zapisany');
}

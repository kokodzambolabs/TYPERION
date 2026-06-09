'use server';

// Server Actions po stronie usera dla strony /mecze:
//   - zapiszTyp        - zapis/edycja typu pojedynczego meczu
//   - pobierzWiecejMeczow - paginacja sekcji "Nadchodzące" / "Zakończone"
// RLS w bazie wymusza user_id = auth.uid() i kickoff_at > now() - tu robimy
// dodatkowo defense in depth, żeby zwrócić ładny komunikat zamiast wyjątku.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { klasyfikujMecze } from '@/lib/klasyfikacjaMeczow';
import { czyPucharowy } from '@/lib/helpers/etapMeczu';

const SchematTypu = z.object({
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
  winnerId: z
    .preprocess(
      (v) => (v === '' || v == null ? null : v),
      z.coerce.number().int().nullable()
    )
    .default(null),
});

export async function zapiszTyp(_prev, formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  const parsed = SchematTypu.safeParse({
    matchId: formData.get('matchId'),
    homeScore: formData.get('homeScore'),
    awayScore: formData.get('awayScore'),
    winnerId: formData.get('winnerId'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { matchId, homeScore, awayScore, winnerId } = parsed.data;

  const { data: mecz, error: meczE } = await supabase
    .from('matches')
    .select('id, kickoff_at, group_name, home_team_id, away_team_id')
    .eq('id', matchId)
    .single();
  if (meczE || !mecz) return { error: 'Mecz nie istnieje.' };

  if (new Date(mecz.kickoff_at) <= new Date()) {
    return { error: 'Typowanie zamknięte - mecz już się rozpoczął.' };
  }

  // Walidacja dla fazy pucharowej
  const pucharowy = czyPucharowy(mecz.group_name);
  const remis = homeScore === awayScore;

  if (pucharowy && remis) {
    // Pucharowy + remis → winnerId MUSI być wybrany
    if (winnerId == null) {
      return {
        error: 'Przy remisie w fazie pucharowej musisz wskazać kto awansuje.',
      };
    }
    // winnerId MUSI być jedną z grających drużyn
    if (winnerId !== mecz.home_team_id && winnerId !== mecz.away_team_id) {
      return {
        error: 'Awansująca drużyna musi być jedną z grających.',
      };
    }
  } else {
    // We wszystkich innych przypadkach winnerId MUSI być null
    if (winnerId != null) {
      return {
        error: 'Wybór awansującego dotyczy tylko remisu w fazie pucharowej.',
      };
    }
  }

  const teraz = new Date().toISOString();
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: user.id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        winner_team_id: winnerId,
        updated_at: teraz,
      },
      { onConflict: 'user_id,match_id' },
    );
  if (error) return { error: error.message };

  revalidatePath('/mecze');
  return {
    ok: 'Typ zapisany.',
    typ: { home_score: homeScore, away_score: awayScore, winner_team_id: winnerId },
    savedAt: Date.now(),
  };
}

// Pobiera cudze typy dla pojedynczego meczu - dla sekcji "Zobacz typy innych"
// na karcie meczu (live/finished). Wywoływane lazy: dopiero po kliknięciu
// przycisku, żeby nie wisieć z 50 zapytaniami na liście meczów.
//
// Bezpieczeństwo: warunek "kickoff_at <= now()" mamy w RLS i tu też dla
// jasnego błędu po polsku. Cudze typy z meczów jeszcze nieobstawionych
// pozostają ukryte (mecze nadchodzące - cudze typy MUSZĄ POZOSTAĆ NIEWIDOCZNE).
//
// Zwraca: lista CUDZYCH typów (własny typ usera odfiltrowany - widzi go już
// na karcie meczu, więc duplikowanie myli i zaśmieca listę).
//   { ok: true, typy: [{ nick, home, away, points }] }  (sortowane malejąco po points)
//   { error: '...' }
const SchematCudzychTypow = z.object({
  matchId: z.coerce.number().int().positive(),
});

export async function pobierzCudzeTypy(args) {
  const parsed = SchematCudzychTypow.safeParse(args);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { matchId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  // Defense in depth: RLS już to zablokuje, ale dla jasnego komunikatu po
  // polsku weryfikujemy kickoff_at po stronie serwera.
  const { data: mecz, error: meczE } = await supabase
    .from('matches')
    .select('id, kickoff_at')
    .eq('id', matchId)
    .single();
  if (meczE || !mecz) return { error: 'Mecz nie istnieje.' };
  if (new Date(mecz.kickoff_at) > new Date()) {
    return { error: 'Cudze typy zobaczysz dopiero po rozpoczęciu meczu.' };
  }

  const { data: predictions, error: predE } = await supabase
    .from('predictions')
    .select('user_id, home_score, away_score, points, winner_team_id')
    .eq('match_id', matchId);
  if (predE) return { error: predE.message };
  if (!predictions || predictions.length === 0) {
    return { ok: true, typy: [] };
  }

  const userIds = predictions.map((p) => p.user_id);
  const { data: profiles, error: profE } = await supabase
    .from('profiles')
    .select('id, nick, is_bot, bot_ukryty')
    .in('id', userIds);
  if (profE) return { error: profE.message };

  // Admin widzi cudze typy ukrytych botów - dla zwykłych userów
  // wypadają z listy całkowicie.
  const { data: jaProfil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  const jestAdmin = !!jaProfil?.is_admin;

  const profilMap = new Map();
  for (const p of profiles || []) {
    profilMap.set(p.id, p);
  }

  const lista = predictions
    .filter((p) => p.user_id !== user.id)
    .filter((p) => {
      if (jestAdmin) return true;
      const prof = profilMap.get(p.user_id);
      return !prof?.bot_ukryty;
    })
    .map((p) => {
      const prof = profilMap.get(p.user_id);
      return {
        userId: p.user_id,
        nick: prof?.nick || 'Anonim',
        isBot: !!prof?.is_bot,
        home: p.home_score,
        away: p.away_score,
        points: p.points ?? null,
        winnerTeamId: p.winner_team_id ?? null,
      };
    })
    .sort((a, b) => {
      const ap = a.points ?? -1;
      const bp = b.points ?? -1;
      if (ap !== bp) return bp - ap;
      return a.nick.localeCompare(b.nick, 'pl');
    });

  return { ok: true, typy: lista };
}

// Paginacja sekcji "Nadchodzące" i "Zakończone".
// kategoria:
//   - 'nadchodzace' (kickoff od jutra 00:00 PL, status='scheduled', sort ASC)
//   - 'zakonczone'  (status='finished', sort DESC po kickoff_at)
// offset/limit jak w SQL - prosty LIMIT/OFFSET na ułożonej liście.
//
// Zwraca: { ok: true, mecze: [...], typy: [...] } albo { error: '...' }.
// Max 50 wierszy na request - przy >100 nadchodzących meczach jednorazowe
// załadowanie reszty wybijało walidację. Klient dociąga porcjami po LIMIT_PORCJI.
const SchematWiecej = z.object({
  kategoria: z.enum(['nadchodzace', 'zakonczone']),
  offset: z.coerce.number().int().min(0),
  limit: z.coerce.number().int().min(1).max(50),
});

export async function pobierzWiecejMeczow(args) {
  const parsed = SchematWiecej.safeParse(args);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { kategoria, offset, limit } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  // Sekcja "zakończone" zawiera też mecze "sierote" (kickoff > 3h temu bez wyniku),
  // więc nie da się ich filtrować jednym .eq('status',...). Pobieramy całą listę
  // i klasyfikujemy w JS - identycznie jak na /mecze.
  const { data: wszystkie, error } = await supabase
    .from('matches')
    .select(
      `
        id, kickoff_at, status, home_score, away_score,
        home_team_id, away_team_id, competition_code, group_name,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `,
    )
    .order('kickoff_at', { ascending: true });
  if (error) return { error: error.message };

  const grupy = klasyfikujMecze(wszystkie || []);
  const lista = kategoria === 'nadchodzace' ? grupy.nadchodzace : grupy.zakonczone;
  const wycinek = lista.slice(offset, offset + limit);

  // Pobierz typy usera dla tej porcji.
  const ids = wycinek.map((m) => m.id);
  let typy = [];
  if (ids.length > 0) {
    const { data, error: typyE } = await supabase
      .from('predictions')
      .select('match_id, home_score, away_score, points')
      .eq('user_id', user.id)
      .in('match_id', ids);
    if (typyE) return { error: typyE.message };
    typy = data || [];
  }

  return {
    ok: true,
    mecze: wycinek,
    typy,
    total: lista.length,
  };
}

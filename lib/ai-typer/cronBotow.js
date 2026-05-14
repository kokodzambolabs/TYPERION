// Rdzeń cron-a botów AI - po refactorze na FIRE-AND-FORGET.
// Bierze nadchodzące mecze (status scheduled, kickoff w oknie 0-120 min od
// teraz) i dla każdej pary aktywny_bot × mecz (gdzie bot jeszcze nie
// typował) wysyła osobne POST do /api/generuj-typ-pojedynczy BEZ czekania
// na odpowiedź. Każde takie wywołanie ma własny 300s budget na Vercel,
// więc kompletne otypowanie 6 meczów × 3 boty nie wpada w timeout.
//
// Dzielony przez:
//   - API Route  app/api/cron/boty-ai/route.js  (cron zewnętrzny)
//   - Server Action wymusGenerowanieBotow()      (przycisk "Wymuś teraz")
// W obu przypadkach funkcja dostaje gotowy klient service_role i baseUrl
// (Vercel + lokalny dev wymagają absolutnego URL-a do self-callback).

// Okno 0-120 min: każde uruchomienie crona "zamiata" wszystko, co startuje
// w najbliższych 2h, i robi dla każdego bota tylko brakujące typy. Stary
// schemat [60, 90] min powodował że mecz mógł wypaść między oknami crona.
export const OKNO_OD_MIN = 0;
export const OKNO_DO_MIN = 120;

// Pobiera mecze w oknie [0, 120] min od teraz (status scheduled,
// kickoff > now). Embed nazw drużyn - panel diagnostyki też tego używa.
export async function pobierzMeczeWOknie(sb) {
  const teraz = new Date();
  const od = new Date(teraz.getTime() + OKNO_OD_MIN * 60 * 1000);
  const doDate = new Date(teraz.getTime() + OKNO_DO_MIN * 60 * 1000);

  const { data, error } = await sb
    .from('matches')
    .select(
      `
        id, kickoff_at, status, competition_code, group_name,
        home_team_id, away_team_id,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `,
    )
    .eq('status', 'scheduled')
    // > now() - mecze które jeszcze nie zaczęły (bo nawet jeśli OKNO_OD_MIN=0,
    // chwila zegarowa mogła już minąć między selectem a startem).
    .gt('kickoff_at', teraz.toISOString())
    .gte('kickoff_at', od.toISOString())
    .lte('kickoff_at', doDate.toISOString())
    .order('kickoff_at', { ascending: true });

  return { mecze: data || [], error };
}

// Wystrzela zadania do endpointa pojedynczego typu - bez await, każde
// żądanie żyje własnym życiem na Vercel. Funkcja wraca po zleceniu, nie
// czeka aż boty skończą.
//
// opcje: { baseUrl } - absolutny URL aplikacji (https://...).
export async function uruchomCronBotow(sb, { baseUrl } = {}) {
  if (!baseUrl) {
    return {
      ok: false,
      error: 'Brak baseUrl - cron nie wie pod jaki URL self-callować.',
    };
  }
  if (!process.env.CRON_SECRET) {
    return { ok: false, error: 'Brak CRON_SECRET w env.' };
  }

  const { mecze, error: meczeE } = await pobierzMeczeWOknie(sb);
  if (meczeE) return { ok: false, error: meczeE.message };
  if (mecze.length === 0) {
    return {
      ok: true,
      message: `Brak meczów do typowania w oknie ${OKNO_OD_MIN}-${OKNO_DO_MIN} min.`,
      zlecone: 0,
      skipped: 0,
      total_matches: 0,
      total_bots: 0,
    };
  }

  const { data: boty, error: botyE } = await sb
    .from('profiles')
    .select('id, nick')
    .eq('is_bot', true)
    .eq('bot_active', true);

  if (botyE) return { ok: false, error: botyE.message };
  if (!boty || boty.length === 0) {
    return {
      ok: true,
      message: 'Brak aktywnych botów.',
      zlecone: 0,
      skipped: 0,
      total_matches: mecze.length,
      total_bots: 0,
    };
  }

  const matchIds = mecze.map((m) => m.id);
  const botIds = boty.map((b) => b.id);
  const { data: istniejace } = await sb
    .from('predictions')
    .select('user_id, match_id')
    .in('match_id', matchIds)
    .in('user_id', botIds);
  const otypowane = new Set(
    (istniejace || []).map((p) => `${p.user_id}:${p.match_id}`),
  );

  const zadania = [];
  let skipped = 0;
  for (const bot of boty) {
    for (const mecz of mecze) {
      if (otypowane.has(`${bot.id}:${mecz.id}`)) {
        skipped++;
        continue;
      }
      zadania.push({ botUserId: bot.id, matchId: mecz.id, botNick: bot.nick });
    }
  }

  // Zamiast fire-and-forget: zbieramy żądania w Promises i używamy await.
  // Gwarantuje to, że środowisko serverless nie zabije funkcji przed
  // faktycznym wysłaniem żądań HTTP i dotarciem ich do endpointa API.
  const obietnice = zadania.map((zad) =>
    fetch(`${baseUrl}/api/generuj-typ-pojedynczy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        botUserId: zad.botUserId,
        matchId: zad.matchId,
      }),
      cache: 'no-store',
    }).catch((e) => {
      console.error(
        `[cron-boty fire-and-forget] zlecanie bot=${zad.botNick} match=${zad.matchId}:`,
        e?.message,
      );
    })
  );

  await Promise.all(obietnice);

  return {
    ok: true,
    zlecone: zadania.length,
    skipped,
    total_matches: mecze.length,
    total_bots: boty.length,
    message:
      zadania.length === 0
        ? 'Wszystkie pary bot×mecz już mają typy. Nic do zlecenia.'
        : `Zlecono ${zadania.length} zadań typowania (boty pracują w tle).`,
  };
}

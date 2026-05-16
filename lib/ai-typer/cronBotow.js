// Rdzeń cron-a botów AI.
// Bierze nadchodzące mecze (status scheduled, kickoff w oknie 0-120 min)
// i dla każdej pary aktywny_bot × mecz (gdzie bot jeszcze nie typował)
// wysyła osobne POST do /api/generuj-typ-pojedynczy z await. Każde takie
// żądanie żyje na własnym kontenerze Vercel (osobny 300s budżet), więc
// 6 meczów × 3 boty = 18 child requestów ma łącznie 18 × 300s budżetu.
// W cronie czekamy na wszystkie odpowiedzi (Promise.all + per-fetch
// timeout 270s) - ale handler w route.js owija to w after() / waitUntil,
// więc klient (cron-job.org) i tak dostaje 200 natychmiast.
//
// Dzielony przez:
//   - API Route  app/api/cron/boty-ai/route.js  (cron zewnętrzny)
//   - Server Action wymusGenerowanieBotow()      (przycisk "Wymuś teraz")
// W obu przypadkach funkcja dostaje gotowy klient service_role i baseUrl
// (Vercel + lokalny dev wymagają absolutnego URL-a do self-callback).

// Okno 0-120 min: każde uruchomienie crona "zamiata" wszystko, co startuje
// w najbliższych 2h, i robi dla każdego bota tylko brakujące typy. Stary
// schemat [60, 90] min powodował że mecz mógł wypaść między oknami crona.
// Te wartości są DOMYŚLNE - obie funkcje przyjmują własne okno przez opcje
// (osobny cron dla ChatGPT-a używa np. 150-240 min).
export const OKNO_OD_MIN = 0;
export const OKNO_DO_MIN = 120;

// Per-fetch timeout - jeden zawieszony bot/model nie blokuje innych ani
// nie pożera całego budżetu kontenera crona. 270s daje child requestowi
// szansę dokończyć (jego własny maxDuration to 300s), a my zdążymy
// zamknąć Promise.all przed 300s budżetem callera.
const FETCH_TIMEOUT_MS = 270 * 1000;

// Pobiera mecze w oknie [oknoOdMin, oknoDoMin] min od teraz (status scheduled,
// kickoff > now). Embed nazw drużyn - panel diagnostyki też tego używa.
// Bez opcji używa domyślnego okna (0-120 min).
export async function pobierzMeczeWOknie(sb, opcje = {}) {
  const { oknoOdMin = OKNO_OD_MIN, oknoDoMin = OKNO_DO_MIN } = opcje;
  const teraz = new Date();
  const od = new Date(teraz.getTime() + oknoOdMin * 60 * 1000);
  const doDate = new Date(teraz.getTime() + oknoDoMin * 60 * 1000);

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

// Dispatch child requesta do endpointa pojedynczego typu z timeoutem.
// Loguje stan na każdym etapie - przy debugowaniu w Vercel logach będzie
// widać, czy fetch w ogóle wystartował, czy doszedł do endpointa i z jakim
// kodem oraz czy endpoint zwrócił ok.
async function dispatchTyp(baseUrl, zad) {
  const ctrl = new AbortController();
  const tId = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  const label = `bot=${zad.botNick} match=${zad.matchId}`;
  console.log(`[cron-boty] dispatch ${label}`);

  try {
    const res = await fetch(`${baseUrl}/api/generuj-typ-pojedynczy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        botUserId: zad.botUserId,
        matchId: zad.matchId,
      }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(tId);

    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.ok === true;
    console.log(
      `[cron-boty] odpowiedź ${label}: http=${res.status} ok=${ok}` +
        (data.error ? ` error=${data.error}` : '') +
        (data.home != null && data.away != null
          ? ` typ=${data.home}:${data.away}`
          : ''),
    );
    return { ...zad, ok, status: res.status, error: data.error };
  } catch (e) {
    clearTimeout(tId);
    const reason =
      e?.name === 'AbortError'
        ? `timeout po ${FETCH_TIMEOUT_MS}ms`
        : e?.message || String(e);
    console.error(`[cron-boty] wyjątek ${label}: ${reason}`);
    return { ...zad, ok: false, error: reason };
  }
}

// Zlicza pary bot × mecz, dispatchuje każdą do endpointa pojedynczego
// typu i zwraca raport. Caller (route.js / server action) decyduje, czy
// czeka na ten Promise pod waitUntil/after, czy synchronicznie.
//
// opcje:
//   baseUrl            - absolutny URL aplikacji (https://...).
//   oknoOdMin/oknoDoMin - własne okno czasowe (domyślnie 0-120 min).
//   includeProviders   - tablica providerów do uwzględnienia (whitelist).
//   excludeProviders   - tablica providerów do pominięcia (blacklist).
// Whitelist ma pierwszeństwo - jeśli podana, excludeProviders ignorujemy.
export async function uruchomCronBotow(sb, opcje = {}) {
  const {
    baseUrl,
    oknoOdMin = OKNO_OD_MIN,
    oknoDoMin = OKNO_DO_MIN,
    includeProviders = null,
    excludeProviders = null,
  } = opcje;

  if (!baseUrl) {
    return {
      ok: false,
      error: 'Brak baseUrl - cron nie wie pod jaki URL self-callować.',
    };
  }
  if (!process.env.CRON_SECRET) {
    return { ok: false, error: 'Brak CRON_SECRET w env.' };
  }

  const { mecze, error: meczeE } = await pobierzMeczeWOknie(sb, {
    oknoOdMin,
    oknoDoMin,
  });
  if (meczeE) {
    console.error('[cron-boty] błąd pobierania meczów:', meczeE.message);
    return { ok: false, error: meczeE.message };
  }
  console.log(
    `[cron-boty] znaleziono ${mecze.length} meczów w oknie ` +
      `${oknoOdMin}-${oknoDoMin} min`,
  );
  if (mecze.length === 0) {
    return {
      ok: true,
      message: `Brak meczów do typowania w oknie ${oknoOdMin}-${oknoDoMin} min.`,
      zlecone: 0,
      sukcesy: 0,
      bledy: 0,
      skipped: 0,
      total_matches: 0,
      total_bots: 0,
    };
  }

  let botyQuery = sb
    .from('profiles')
    .select('id, nick, ai_provider')
    .eq('is_bot', true)
    .eq('bot_active', true);

  if (includeProviders && includeProviders.length > 0) {
    botyQuery = botyQuery.in('ai_provider', includeProviders);
  } else if (excludeProviders && excludeProviders.length > 0) {
    // Supabase `not.in` używa składni `(a,b,c)`.
    botyQuery = botyQuery.not(
      'ai_provider',
      'in',
      `(${excludeProviders.join(',')})`,
    );
  }

  const { data: boty, error: botyE } = await botyQuery;

  if (botyE) {
    console.error('[cron-boty] błąd pobierania botów:', botyE.message);
    return { ok: false, error: botyE.message };
  }
  console.log(
    `[cron-boty] aktywnych botów: ${boty?.length ?? 0}` +
      (includeProviders ? ` (whitelist=${includeProviders.join(',')})` : '') +
      (excludeProviders && !includeProviders
        ? ` (blacklist=${excludeProviders.join(',')})`
        : ''),
  );
  if (!boty || boty.length === 0) {
    return {
      ok: true,
      message: 'Brak aktywnych botów.',
      zlecone: 0,
      sukcesy: 0,
      bledy: 0,
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

  console.log(
    `[cron-boty] zadań do zlecenia: ${zadania.length} (pominięto ${skipped} już otypowanych)`,
  );

  if (zadania.length === 0) {
    return {
      ok: true,
      message: 'Wszystkie pary bot×mecz już mają typy. Nic do zlecenia.',
      zlecone: 0,
      sukcesy: 0,
      bledy: 0,
      skipped,
      total_matches: mecze.length,
      total_bots: boty.length,
    };
  }

  const wyniki = await Promise.all(
    zadania.map((zad) => dispatchTyp(baseUrl, zad)),
  );

  const sukcesy = wyniki.filter((w) => w.ok).length;
  const bledy = wyniki.length - sukcesy;

  return {
    ok: true,
    zlecone: zadania.length,
    sukcesy,
    bledy,
    skipped,
    total_matches: mecze.length,
    total_bots: boty.length,
    wyniki,
    message: `Zlecono ${zadania.length} zadań - sukcesy=${sukcesy}, błędy=${bledy}.`,
  };
}

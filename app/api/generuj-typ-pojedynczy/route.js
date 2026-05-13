// API Route: generuje typ dla JEDNEJ pary (bot × mecz).
//
// Wzorzec fire-and-forget: Server Action wygenerujTypyMasowo() oraz cron
// /api/cron/boty-ai wysyłają tu osobne żądanie dla każdej kombinacji
// bota i meczu. Dzięki temu każde wywołanie AI ma własny 300s budget
// platformy hostingowej - synchroniczne typowanie wielu botów × wielu
// meczów w jednej akcji nie mieści się w 300s i Vercel je zabija.
//
// Autoryzacja: Authorization: Bearer ${CRON_SECRET} (ten sam sekret co
// inne crony). Endpoint NIE może być publiczny - generuje typy w imieniu
// botów przez service_role.
//
// Idempotentność: predictions ma UNIQUE (user_id, match_id), więc upsert
// pozwala adminowi re-generować typ (np. przy testowaniu promptów).

import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { generujTypAI } from '@/lib/ai-typer';
import { NAZWY_COMPETITIONS } from '@/lib/competitions';
import { formatGrupa } from '@/lib/format';

export const dynamic = 'force-dynamic';
// Vercel Hobby max = 300s. Pojedyncze wywołanie AI z thinking + parsowaniem
// + retry przy Gemini overload mieści się w tym budżecie.
export const maxDuration = 300;

function buildMatchData(match) {
  const grupa = formatGrupa(match.group_name);
  return {
    homeTeam: match.home_team?.name || `#${match.home_team_id}`,
    awayTeam: match.away_team?.name || `#${match.away_team_id}`,
    kickoffDate: new Date(match.kickoff_at).toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
    }),
    competitionName:
      NAZWY_COMPETITIONS[match.competition_code] ||
      match.competition_code ||
      '',
    groupInfo: grupa ? `Faza/Grupa: ${grupa}` : '',
  };
}

export async function POST(request) {
  const oczekiwany = process.env.CRON_SECRET;
  if (!oczekiwany) {
    console.error('[generuj-typ-pojedynczy] brak CRON_SECRET w env');
    return Response.json(
      { ok: false, error: 'Brak CRON_SECRET w env.' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${oczekiwany}`) {
    console.warn('[generuj-typ-pojedynczy] nieautoryzowane wywołanie');
    return Response.json(
      { ok: false, error: 'Brak autoryzacji.' },
      { status: 401 },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Nieprawidłowy JSON.' },
      { status: 400 },
    );
  }

  const { botUserId, matchId } = payload || {};
  if (!botUserId || !matchId) {
    return Response.json(
      { ok: false, error: 'Wymagane: botUserId i matchId.' },
      { status: 400 },
    );
  }

  let sb;
  try {
    sb = utworzKlientaServiceRole();
  } catch (e) {
    return Response.json(
      { ok: false, error: e?.message || 'Błąd klienta Supabase.' },
      { status: 500 },
    );
  }

  // 1. Bot
  const { data: bot, error: botE } = await sb
    .from('profiles')
    .select('id, nick, is_bot, bot_active, ai_provider, ai_model, ai_prompt_type')
    .eq('id', botUserId)
    .eq('is_bot', true)
    .single();

  if (botE || !bot) {
    return Response.json(
      { ok: false, error: 'Bot nie istnieje.' },
      { status: 404 },
    );
  }
  if (!bot.bot_active) {
    return Response.json(
      { ok: false, error: `Bot ${bot.nick} jest wyłączony.` },
      { status: 409 },
    );
  }
  if (!bot.ai_provider || !bot.ai_model) {
    await sb.from('ai_typing_logs').insert({
      user_id: bot.id,
      match_id: matchId,
      ai_provider: bot.ai_provider,
      ai_model: bot.ai_model,
      prompt_type: bot.ai_prompt_type,
      error: 'Bot nie ma skonfigurowanego modelu AI.',
    });
    return Response.json(
      { ok: false, bot: bot.nick, error: 'Brak modelu AI.' },
      { status: 409 },
    );
  }

  // 2. Mecz
  const { data: match, error: matchE } = await sb
    .from('matches')
    .select(
      `
        id, kickoff_at, status, competition_code, group_name,
        home_team_id, away_team_id,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `,
    )
    .eq('id', matchId)
    .single();

  if (matchE || !match) {
    return Response.json(
      { ok: false, error: 'Mecz nie istnieje.' },
      { status: 404 },
    );
  }
  if (new Date(match.kickoff_at) <= new Date()) {
    return Response.json(
      { ok: false, bot: bot.nick, error: 'Mecz już się rozpoczął.' },
      { status: 409 },
    );
  }

  const matchData = buildMatchData(match);

  // 3. AI + zapis
  try {
    const aiResult = await generujTypAI(bot, matchData);

    const { error: upsertE } = await sb.from('predictions').upsert(
      {
        user_id: bot.id,
        match_id: match.id,
        home_score: aiResult.home,
        away_score: aiResult.away,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,match_id' },
    );
    if (upsertE) throw new Error(`Błąd zapisu typu: ${upsertE.message}`);

    await sb.from('ai_typing_logs').insert({
      user_id: bot.id,
      match_id: match.id,
      ai_provider: bot.ai_provider,
      ai_model: bot.ai_model,
      prompt_type: bot.ai_prompt_type,
      prompt_used: aiResult.promptUsed,
      raw_response: aiResult.rawResponse,
      parsed_home: aiResult.home,
      parsed_away: aiResult.away,
      uzasadnienie: null,
      tokens_input: aiResult.tokensInput,
      tokens_output: aiResult.tokensOutput,
      cost_usd: aiResult.costUsd,
    });

    return Response.json({
      ok: true,
      bot: bot.nick,
      botId: bot.id,
      matchId: match.id,
      home: aiResult.home,
      away: aiResult.away,
      cost: aiResult.costUsd,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
    });
  } catch (e) {
    await sb.from('ai_typing_logs').insert({
      user_id: bot.id,
      match_id: match.id,
      ai_provider: bot.ai_provider,
      ai_model: bot.ai_model,
      prompt_type: bot.ai_prompt_type,
      prompt_used: e.promptUsed || null,
      raw_response: e.rawResponse || null,
      tokens_input: e.tokensInput || null,
      tokens_output: e.tokensOutput || null,
      error: e.message,
    });
    return Response.json(
      {
        ok: false,
        bot: bot.nick,
        botId: bot.id,
        matchId: match.id,
        error: e.message,
      },
      { status: 500 },
    );
  }
}

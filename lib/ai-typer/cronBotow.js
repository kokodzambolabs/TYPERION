// Rdzeń cron-a botów AI: bierze mecze startujące w oknie 60-90 min i
// odpala każdego aktywnego bota na każdym z nich (pomijając pary już
// otypowane). Dzielony przez:
//   - API Route  app/api/cron/boty-ai/route.js  (cron zewnętrzny)
//   - Server Action wymusGenerowanieBotow()      (przycisk "Wymuś teraz")
//
// Funkcja dostaje gotowy klient service_role - nie zna autoryzacji,
// to robi wywołujący (Bearer secret w route, sprawdzenie admina w akcji).

import { generujTypAI } from './index';
import { NAZWY_COMPETITIONS } from '@/lib/competitions';
import { formatGrupa } from '@/lib/format';

export const OKNO_OD_MIN = 60;
export const OKNO_DO_MIN = 90;

function buildMatchData(match) {
  const grupa = formatGrupa(match.group_name);
  return {
    homeTeam: match.home_team?.name || `#${match.home_team_id}`,
    awayTeam: match.away_team?.name || `#${match.away_team_id}`,
    kickoffDate: new Date(match.kickoff_at).toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
    }),
    competitionName:
      NAZWY_COMPETITIONS[match.competition_code] || match.competition_code || '',
    groupInfo: grupa ? `Faza/Grupa: ${grupa}` : '',
  };
}

// Pobiera mecze z okna [60, 90] min od teraz (status scheduled), z embedem
// nazw drużyn. Eksportowane osobno - panel diagnostyki też tego używa.
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
    .gte('kickoff_at', od.toISOString())
    .lte('kickoff_at', doDate.toISOString())
    .order('kickoff_at', { ascending: true });

  return { mecze: data || [], error };
}

export async function uruchomCronBotow(sb) {
  const { mecze, error: meczeE } = await pobierzMeczeWOknie(sb);
  if (meczeE) return { ok: false, error: meczeE.message };
  if (mecze.length === 0) {
    return {
      ok: true,
      message: `Brak meczów do typowania w oknie ${OKNO_OD_MIN}-${OKNO_DO_MIN} min.`,
      processed: 0,
      errors: 0,
      skipped: 0,
      total_matches: 0,
      total_bots: 0,
      results: [],
    };
  }

  const { data: boty, error: botyE } = await sb
    .from('profiles')
    .select('id, nick, ai_provider, ai_model, ai_prompt_type')
    .eq('is_bot', true)
    .eq('bot_active', true);

  if (botyE) return { ok: false, error: botyE.message };
  if (!boty || boty.length === 0) {
    return {
      ok: true,
      message: 'Brak aktywnych botów.',
      processed: 0,
      errors: 0,
      skipped: 0,
      total_matches: mecze.length,
      total_bots: 0,
      results: [],
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

  let processed = 0;
  let errors = 0;
  let skipped = 0;
  const results = [];

  for (const mecz of mecze) {
    const matchData = buildMatchData(mecz);
    for (const bot of boty) {
      if (otypowane.has(`${bot.id}:${mecz.id}`)) {
        skipped++;
        continue;
      }
      if (!bot.ai_provider || !bot.ai_model) {
        errors++;
        await sb.from('ai_typing_logs').insert({
          user_id: bot.id,
          match_id: mecz.id,
          ai_provider: bot.ai_provider,
          ai_model: bot.ai_model,
          prompt_type: bot.ai_prompt_type,
          error: 'Bot nie ma skonfigurowanego modelu AI.',
        });
        results.push({
          bot: bot.nick,
          match: `${matchData.homeTeam} vs ${matchData.awayTeam}`,
          error: 'Brak modelu AI.',
        });
        continue;
      }

      try {
        const aiResult = await generujTypAI(bot, matchData);

        const { error: upsertE } = await sb.from('predictions').upsert(
          {
            user_id: bot.id,
            match_id: mecz.id,
            home_score: aiResult.home,
            away_score: aiResult.away,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,match_id' },
        );
        if (upsertE) throw new Error(`Błąd zapisu typu: ${upsertE.message}`);

        await sb.from('ai_typing_logs').insert({
          user_id: bot.id,
          match_id: mecz.id,
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

        processed++;
        results.push({
          bot: bot.nick,
          match: `${matchData.homeTeam} vs ${matchData.awayTeam}`,
          typ: `${aiResult.home}:${aiResult.away}`,
          cost: aiResult.costUsd,
        });
      } catch (e) {
        errors++;
        await sb.from('ai_typing_logs').insert({
          user_id: bot.id,
          match_id: mecz.id,
          ai_provider: bot.ai_provider,
          ai_model: bot.ai_model,
          prompt_type: bot.ai_prompt_type,
          prompt_used: e.promptUsed || null,
          raw_response: e.rawResponse || null,
          tokens_input: e.tokensInput || null,
          tokens_output: e.tokensOutput || null,
          error: e.message,
        });
        results.push({
          bot: bot.nick,
          match: `${matchData.homeTeam} vs ${matchData.awayTeam}`,
          error: e.message,
        });
      }
    }
  }

  return {
    ok: true,
    processed,
    errors,
    skipped,
    total_matches: mecze.length,
    total_bots: boty.length,
    results,
  };
}

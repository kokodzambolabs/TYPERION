'use server';

// Server Actions dla AI botów typujących mecze.
//
//   wygenerujTypDlaMeczu(botUserId, matchId)
//     - waliduje admina, wczytuje bota i mecz, sprawdza czy bot już
//       nie typował, wywołuje AI, zapisuje typ do `predictions` (przez
//       service_role - omija RLS), wkłada wpis do `ai_typing_logs`.
//     - Błąd AI też ląduje w logu (kolumna `error`), żeby admin widział
//       co poszło nie tak (timeout, niepoprawny JSON, błąd providera).
//
//   wygenerujTypyMasowo(matchIds)
//     - dla wszystkich aktywnych botów × każdego z meczów.
//     - sekwencyjnie (rate limity providerów) i odporne na błąd jednego
//       wywołania - robi pełną pętlę i zwraca podsumowanie.
//
//   utworzBotaAI({ nick, email, ai_provider, ai_model, ai_prompt_type })
//     - tworzy auth user przez Supabase Admin API i profile z is_bot=true.
//
// Zapis typu i logu robimy SERVICE_ROLE-em, bo:
//   - typ wstawiamy w imieniu innego usera (bota) - RLS by zablokował
//     userowi-adminowi wstawienie wiersza z user_id != auth.uid(),
//   - logi mają polityki tylko SELECT dla admina (INSERT przez SR).

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { generujTypAI } from '@/lib/ai-typer';
import { uruchomCronBotow } from '@/lib/ai-typer/cronBotow';
import { NAZWY_COMPETITIONS } from '@/lib/competitions';
import { formatGrupa } from '@/lib/format';

async function sprawdzAdminaWAkcji() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  const { data: profil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profil?.is_admin) {
    return { error: 'Brak uprawnień admina.' };
  }
  return { user };
}

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

// Wygeneruj typ dla pojedynczego meczu i bota.
// Zwraca { ok, home, away, cost, ... } albo { error }.
export async function wygenerujTypDlaMeczu(botUserId, matchId) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  const sb = utworzKlientaServiceRole();

  const { data: bot, error: botE } = await sb
    .from('profiles')
    .select('id, nick, is_bot, bot_active, ai_provider, ai_model, ai_prompt_type')
    .eq('id', botUserId)
    .eq('is_bot', true)
    .single();

  if (botE || !bot) return { error: 'Bot nie istnieje.' };
  if (!bot.bot_active) {
    return { error: `Bot ${bot.nick} jest wyłączony.` };
  }
  if (!bot.ai_provider || !bot.ai_model) {
    return { error: `Bot ${bot.nick} nie ma skonfigurowanego modelu AI.` };
  }

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

  if (matchE || !match) return { error: 'Mecz nie istnieje.' };

  // Po starcie meczu typowanie nie ma sensu - zostawiamy bot bez wpisu.
  if (new Date(match.kickoff_at) <= new Date()) {
    return { error: 'Mecz już się rozpoczął - nie typujemy.' };
  }

  const matchData = buildMatchData(match);

  try {
    const aiResult = await generujTypAI(bot, matchData);

    // UPSERT zamiast INSERT - admin może re-generować typ (np. testując
    // różne prompty). Klucz: unique (user_id, match_id) z SUPABASE_SETUP.sql.
    const { error: insertError } = await sb.from('predictions').upsert(
      {
        user_id: botUserId,
        match_id: matchId,
        home_score: aiResult.home,
        away_score: aiResult.away,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,match_id' },
    );

    if (insertError) {
      throw new Error(`Błąd zapisu typu: ${insertError.message}`);
    }

    await sb.from('ai_typing_logs').insert({
      user_id: botUserId,
      match_id: matchId,
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

    revalidatePath('/admin/boty-ai');
    revalidatePath('/admin/boty-ai/logi');
    revalidatePath('/mecze');

    return {
      ok: true,
      bot: bot.nick,
      home: aiResult.home,
      away: aiResult.away,
      cost: aiResult.costUsd,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
    };
  } catch (e) {
    // Nawet przy błędzie loguj - admin musi widzieć co AI zwróciło.
    await sb.from('ai_typing_logs').insert({
      user_id: botUserId,
      match_id: matchId,
      ai_provider: bot.ai_provider,
      ai_model: bot.ai_model,
      prompt_type: bot.ai_prompt_type,
      prompt_used: e.promptUsed || null,
      raw_response: e.rawResponse || null,
      tokens_input: e.tokensInput || null,
      tokens_output: e.tokensOutput || null,
      error: e.message,
    });

    return { error: `Błąd AI (${bot.nick}): ${e.message}` };
  }
}

// Wygeneruj typy dla WIELU meczów × WSZYSTKICH botów.
// Sekwencyjnie - providery mają rate-limity, a 9 wywołań nie potrzebuje
// równoległości. Każdy wynik jest osobnym wpisem na liście,
// dzięki czemu UI może pokazać postęp i podsumowanie kosztu.
export async function wygenerujTypyMasowo(matchIds) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    return { error: 'Wybierz przynajmniej jeden mecz.' };
  }

  const sb = utworzKlientaServiceRole();
  const { data: boty, error: botyE } = await sb
    .from('profiles')
    .select('id, nick')
    .eq('is_bot', true)
    .eq('bot_active', true)
    .order('created_at', { ascending: true });

  if (botyE) return { error: `Błąd pobrania botów: ${botyE.message}` };
  if (!boty || boty.length === 0) {
    return { error: 'Brak aktywnych botów AI w bazie. Utwórz lub włącz boty w panelu admina.' };
  }

  const wyniki = [];
  let lacznyKoszt = 0;
  let sukcesy = 0;
  let bledy = 0;

  for (const bot of boty) {
    for (const matchId of matchIds) {
      const w = await wygenerujTypDlaMeczu(bot.id, matchId);
      const wpis = { bot: bot.nick, botId: bot.id, matchId, ...w };
      wyniki.push(wpis);
      if (w.ok) {
        sukcesy++;
        lacznyKoszt += w.cost || 0;
      } else {
        bledy++;
      }
    }
  }

  revalidatePath('/admin/boty-ai');
  revalidatePath('/admin/boty-ai/logi');
  revalidatePath('/mecze');

  return { ok: true, wyniki, lacznyKoszt, sukcesy, bledy };
}

// Tworzy auth.user dla bota (przez Admin API service_role) i profile
// z is_bot=true. Email jest sztuczny (nie używany do logowania), hasło
// jest losowe (boty się nie logują - kontaktują się z bazą tylko przez
// service_role w Server Action).
export async function utworzBotaAI({
  nick,
  email,
  ai_provider,
  ai_model,
  ai_prompt_type,
}) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  if (!nick || !email || !ai_provider || !ai_model || !ai_prompt_type) {
    return { error: 'Uzupełnij wszystkie pola.' };
  }
  if (!['anthropic', 'google', 'openai'].includes(ai_provider)) {
    return { error: 'Nieprawidłowy provider.' };
  }
  if (!['deep_research', 'deep_research_thinking', 'quick'].includes(ai_prompt_type)) {
    return { error: 'Nieprawidłowy typ promptu.' };
  }

  const sb = utworzKlientaServiceRole();

  // Czy nick już zajęty? profiles.nick UNIQUE - lepiej dać miły błąd.
  const { data: zajety } = await sb
    .from('profiles')
    .select('id')
    .eq('nick', nick)
    .maybeSingle();
  if (zajety) {
    return { error: `Nick "${nick}" jest już zajęty.` };
  }

  // Losowe hasło 32 znaki - i tak nikt się nie loguje.
  const haslo =
    'bot_' +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2);

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: haslo,
    email_confirm: true,
    user_metadata: { nick },
  });

  if (createErr) {
    return { error: `Błąd tworzenia auth user: ${createErr.message}` };
  }
  const newId = created?.user?.id;
  if (!newId) {
    return { error: 'Nie udało się utworzyć usera (brak id).' };
  }

  // Trigger handle_new_user założył już profil z nickiem z metadata.
  // Aktualizujemy go o pola bota. Jeśli triggera nie ma - upsert dorobi.
  const { error: profErr } = await sb
    .from('profiles')
    .upsert(
      {
        id: newId,
        nick,
        is_bot: true,
        bot_active: true,
        ai_provider,
        ai_model,
        ai_prompt_type,
        regulamin_zaakceptowany: true,
      },
      { onConflict: 'id' },
    );

  if (profErr) {
    // Cofamy auth user - inaczej zostanie sierota bez profilu.
    await sb.auth.admin.deleteUser(newId);
    return { error: `Błąd zapisu profilu: ${profErr.message}` };
  }

  revalidatePath('/admin/boty-ai');
  return { ok: true, id: newId, nick };
}

// Włącza/wyłącza bota (profiles.bot_active). Wyłączony bot nie typuje
// (ani ręcznie, ani z crona), ale jego historia typów i miejsce w
// rankingu pozostają.
export async function przelaczAktywnoscBota(botUserId, aktywny) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  const sb = utworzKlientaServiceRole();
  const { error } = await sb
    .from('profiles')
    .update({ bot_active: !!aktywny })
    .eq('id', botUserId)
    .eq('is_bot', true);

  if (error) return { error: `Błąd zmiany statusu bota: ${error.message}` };

  revalidatePath('/admin/boty-ai');
  return { ok: true };
}

// Ręczne odpalenie tego, co normalnie robi cron /api/cron/boty-ai:
// mecze startujące za 60-90 min × wszystkie aktywne boty (pomija pary
// już otypowane). Przycisk "🚀 Wymuś teraz" w panelu diagnostyki.
export async function wymusGenerowanieBotow() {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  const sb = utworzKlientaServiceRole();
  const wynik = await uruchomCronBotow(sb);

  revalidatePath('/admin/boty-ai');
  revalidatePath('/admin/boty-ai/diagnostyka-cron');
  revalidatePath('/admin/boty-ai/logi');
  revalidatePath('/mecze');

  if (!wynik.ok) return { error: wynik.error || 'Błąd uruchomienia botów.' };
  return wynik;
}

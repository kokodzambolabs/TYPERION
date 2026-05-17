// API Route: generuje odpowiedź AI bota na JEDNO pytanie bonusowe.
//
// Wzorzec fire-and-forget identyczny jak /api/generuj-typ-pojedynczy:
// Server Action wygenerujOdpowiedziBonusoweAI() wysyła tu osobny POST
// dla każdej kombinacji bot × pytanie. Każde wywołanie ma własny 300s
// budget Vercel - 18 botów × 20 pytań = 360 zadań, sumarycznie ~20-30 min
// jeśli wszystko leci równolegle.
//
// Autoryzacja: Authorization: Bearer ${CRON_SECRET}.
//
// Idempotentność: bonus_answers ma UNIQUE (user_id, question_id), więc
// upsert pozwala adminowi re-generować odpowiedź (np. przy testach).
//
// Obsługujemy tylko typy: dropdown_weighted, boolean_weighted, dropdown_other.
// Stare typy (team/boolean/text/number) zostają adminowi do ręcznego
// uzupełnienia - boty MŚ 2026 dostają tylko nowe pytania.

import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { generujOdpowiedzBonusowaAI } from '@/lib/ai-typer/bonusy';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const OBSLUGIWANE = ['dropdown_weighted', 'boolean_weighted', 'dropdown_other'];

export async function POST(request) {
  const oczekiwany = process.env.CRON_SECRET;
  if (!oczekiwany) {
    console.error('[generuj-bonus-pojedynczy] brak CRON_SECRET w env');
    return Response.json(
      { ok: false, error: 'Brak CRON_SECRET w env.' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${oczekiwany}`) {
    console.warn('[generuj-bonus-pojedynczy] nieautoryzowane wywołanie');
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

  const { botUserId, questionId } = payload || {};
  if (!botUserId || !questionId) {
    return Response.json(
      { ok: false, error: 'Wymagane: botUserId i questionId.' },
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

  // Bot
  const { data: bot, error: botE } = await sb
    .from('profiles')
    .select('id, nick, is_bot, bot_active, ai_provider, ai_model, ai_prompt_type')
    .eq('id', botUserId)
    .eq('is_bot', true)
    .single();
  if (botE || !bot) {
    return Response.json({ ok: false, error: 'Bot nie istnieje.' }, { status: 404 });
  }
  if (!bot.bot_active) {
    return Response.json(
      { ok: false, error: `Bot ${bot.nick} jest wyłączony.` },
      { status: 409 },
    );
  }
  if (!bot.ai_provider || !bot.ai_model) {
    return Response.json(
      { ok: false, bot: bot.nick, error: 'Brak modelu AI.' },
      { status: 409 },
    );
  }

  // Pytanie + opcje
  const [{ data: pytanie, error: pytE }, { data: opcje, error: opcjeE }] =
    await Promise.all([
      sb.from('bonus_questions').select('*').eq('id', questionId).single(),
      sb
        .from('bonus_question_options')
        .select('id, opcja_text, punkty, kolejnosc')
        .eq('question_id', questionId)
        .order('kolejnosc', { ascending: true }),
    ]);

  if (pytE || !pytanie) {
    return Response.json(
      { ok: false, error: 'Pytanie nie istnieje.' },
      { status: 404 },
    );
  }
  if (!OBSLUGIWANE.includes(pytanie.question_type)) {
    return Response.json(
      {
        ok: false,
        error: `Typ pytania ${pytanie.question_type} nie jest obsługiwany przez AI.`,
      },
      { status: 400 },
    );
  }
  if (opcjeE) {
    return Response.json(
      { ok: false, error: `Błąd pobrania opcji: ${opcjeE.message}` },
      { status: 500 },
    );
  }
  if (!opcje || opcje.length === 0) {
    return Response.json(
      { ok: false, error: 'Pytanie nie ma jeszcze opcji.' },
      { status: 409 },
    );
  }
  if (pytanie.is_settled) {
    return Response.json(
      { ok: false, error: 'Pytanie jest już rozliczone.' },
      { status: 409 },
    );
  }

  // AI + zapis
  try {
    const aiResult = await generujOdpowiedzBonusowaAI(bot, pytanie, opcje);

    const wybranaOpcja = opcje.find(
      (o) => o.opcja_text.toLowerCase() === aiResult.odpowiedz.toLowerCase(),
    );

    const { error: upsertE } = await sb.from('bonus_answers').upsert(
      {
        user_id: bot.id,
        question_id: pytanie.id,
        selected_option_id: wybranaOpcja?.id ?? null,
        answer_text: wybranaOpcja?.opcja_text ?? aiResult.odpowiedz,
        answer_other_flag: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,question_id' },
    );
    if (upsertE) throw new Error(`Błąd zapisu odpowiedzi: ${upsertE.message}`);

    // Logujemy do ai_typing_logs (match_id zostawiamy NULL - to bonus, nie mecz).
    // Jeśli kolumna match_id ma NOT NULL constraint, log po prostu się pominie.
    await sb
      .from('ai_typing_logs')
      .insert({
        user_id: bot.id,
        match_id: null,
        ai_provider: bot.ai_provider,
        ai_model: bot.ai_model,
        prompt_type: bot.ai_prompt_type,
        prompt_used: aiResult.promptUsed,
        raw_response: aiResult.rawResponse,
        parsed_home: null,
        parsed_away: null,
        uzasadnienie: `BONUS Q#${pytanie.id} → "${aiResult.odpowiedz}"`,
        tokens_input: aiResult.tokensInput,
        tokens_output: aiResult.tokensOutput,
        cost_usd: aiResult.costUsd,
      })
      .then(() => {})
      .catch((e) => {
        console.warn(`[bonus log] nie zapisano (zignorowano): ${e?.message}`);
      });

    return Response.json({
      ok: true,
      bot: bot.nick,
      botId: bot.id,
      questionId: pytanie.id,
      odpowiedz: aiResult.odpowiedz,
      cost: aiResult.costUsd,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
    });
  } catch (e) {
    await sb
      .from('ai_typing_logs')
      .insert({
        user_id: bot.id,
        match_id: null,
        ai_provider: bot.ai_provider,
        ai_model: bot.ai_model,
        prompt_type: bot.ai_prompt_type,
        prompt_used: e.promptUsed || null,
        raw_response: e.rawResponse || null,
        uzasadnienie: `BONUS Q#${pytanie.id} (błąd)`,
        tokens_input: e.tokensInput || null,
        tokens_output: e.tokensOutput || null,
        error: e.message,
      })
      .then(() => {})
      .catch(() => {});
    return Response.json(
      {
        ok: false,
        bot: bot.nick,
        botId: bot.id,
        questionId: pytanie.id,
        error: e.message,
      },
      { status: 500 },
    );
  }
}

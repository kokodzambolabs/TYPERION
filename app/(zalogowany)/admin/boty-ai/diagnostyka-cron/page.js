// Diagnostyka cron-a botów AI (/admin/boty-ai/diagnostyka-cron).
// Server Component - pokazuje:
//   - kiedy boty ostatnio coś typowały (max created_at z ai_typing_logs),
//   - listę meczów w oknie cron-a (60-90 min) i które boty już je otypowały,
//   - przycisk "🚀 Wymuś teraz" (Server Action wymusGenerowanieBotow).
// Wszystko ciągniemy service_role-em - inaczej RLS chowa typy botów na
// nadchodzące mecze i statusy są mylące.

import Link from 'next/link';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { pobierzMeczeWOknie, OKNO_OD_MIN, OKNO_DO_MIN } from '@/lib/ai-typer/cronBotow';
import { formatujDateKrotkoPL, formatGrupa, formatPromptType } from '@/lib/format';
import Button from '@/components/Button';
import PanelWymusCron from './PanelWymusCron';

export default async function DiagnostykaCronPage() {
  // Dostęp do /admin/** pilnuje admin/layout.js. Dane ciągniemy service_role-em,
  // bo RLS chowa typy botów na nadchodzące mecze (statusy byłyby mylące).
  const sb = utworzKlientaServiceRole();

  const { data: boty } = await sb
    .from('profiles')
    .select('id, nick, ai_provider, ai_model, ai_prompt_type, bot_active')
    .eq('is_bot', true)
    .order('created_at', { ascending: true });

  const botMap = new Map((boty || []).map((b) => [b.id, b]));
  const aktywneBoty = (boty || []).filter((b) => b.bot_active);

  // Ostatnie wywołanie AI (ostatni wpis w logach).
  const { data: ostatnieLogi } = await sb
    .from('ai_typing_logs')
    .select('created_at, user_id, ai_provider, ai_model, error')
    .order('created_at', { ascending: false })
    .limit(1);
  const ostatniLog = ostatnieLogi?.[0] || null;

  // Mecze w oknie cron-a + ile (i którzy) bot(ów) już je otypowało.
  const { mecze } = await pobierzMeczeWOknie(sb);
  const matchIds = (mecze || []).map((m) => m.id);
  let typyPerMatch = new Map(); // matchId -> Set(botId)
  if (matchIds.length > 0 && aktywneBoty.length > 0) {
    const { data: typy } = await sb
      .from('predictions')
      .select('match_id, user_id')
      .in('match_id', matchIds)
      .in(
        'user_id',
        aktywneBoty.map((b) => b.id),
      );
    for (const t of typy || []) {
      if (!typyPerMatch.has(t.match_id)) typyPerMatch.set(t.match_id, new Set());
      typyPerMatch.get(t.match_id).add(t.user_id);
    }
  }

  const meczeZMeta = (mecze || []).map((m) => {
    const otypowani = typyPerMatch.get(m.id) || new Set();
    return {
      id: m.id,
      kickoff_at: m.kickoff_at,
      competition_code: m.competition_code,
      grupa: formatGrupa(m.group_name),
      home: m.home_team?.name || `#${m.id}`,
      away: m.away_team?.name || `#${m.id}`,
      otypowani: otypowani.size,
      braki: aktywneBoty
        .filter((b) => !otypowani.has(b.id))
        .map((b) => b.nick),
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">
            🩺 Diagnostyka cron-a botów
          </h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Cron <code className="rounded bg-emerald-900/60 px-1">/api/cron/boty-ai</code>{' '}
            (co godzinę, zewnętrznie) typuje mecze startujące za{' '}
            {OKNO_OD_MIN}–{OKNO_DO_MIN} min wszystkimi aktywnymi botami.
          </p>
        </div>
        <Link href="/admin/boty-ai">
          <Button variant="secondary">← Wróć</Button>
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
        <h2 className="mb-3 text-lg font-bold text-emerald-50">
          Ostatnia aktywność botów
        </h2>
        {ostatniLog ? (
          <p className="text-sm text-emerald-200/80">
            Ostatni wpis w logach:{' '}
            <strong className="text-emerald-50">
              {formatujDateKrotkoPL(ostatniLog.created_at)}
            </strong>{' '}
            · {botMap.get(ostatniLog.user_id)?.nick || '—'} ·{' '}
            <span className="font-mono">{ostatniLog.ai_model}</span>{' '}
            {ostatniLog.error ? (
              <span className="text-rose-300">(błąd)</span>
            ) : (
              <span className="text-emerald-300/70">(ok)</span>
            )}
            <br />
            <Link
              href="/admin/boty-ai/logi"
              className="text-emerald-300 underline hover:text-emerald-200"
            >
              → pełne logi
            </Link>
          </p>
        ) : (
          <p className="text-sm text-emerald-300/70">Brak żadnych logów AI.</p>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
        <h2 className="mb-3 text-lg font-bold text-emerald-50">
          Aktywne boty ({aktywneBoty.length} z {boty?.length ?? 0})
        </h2>
        {aktywneBoty.length === 0 ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            ⚠️ Żaden bot nie jest aktywny - cron nic nie wytypuje.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-xs">
            {aktywneBoty.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-emerald-900/40 bg-emerald-950/40 px-3 py-1.5 text-emerald-100"
              >
                <span className="font-semibold">{b.nick}</span>{' '}
                <span className="text-emerald-300/60">
                  · {b.ai_model} · {formatPromptType(b.ai_prompt_type)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5">
        <h2 className="mb-3 text-lg font-bold text-emerald-50">
          Mecze w oknie cron-a ({meczeZMeta.length})
        </h2>
        {meczeZMeta.length === 0 ? (
          <p className="text-sm text-emerald-300/70">
            Brak meczów startujących za {OKNO_OD_MIN}–{OKNO_DO_MIN} min.
            Cron przy najbliższym wywołaniu nic nie zrobi.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {meczeZMeta.map((m) => {
              const komplet =
                aktywneBoty.length > 0 && m.otypowani >= aktywneBoty.length;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-900/40 bg-emerald-950/40 px-3 py-2 text-sm"
                >
                  <span className="shrink-0 text-xs text-emerald-200/70">
                    {formatujDateKrotkoPL(m.kickoff_at)}
                  </span>
                  {m.competition_code && (
                    <span className="shrink-0 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                      {m.competition_code}
                    </span>
                  )}
                  {m.grupa && (
                    <span className="shrink-0 rounded bg-emerald-700/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                      {m.grupa}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-emerald-50">
                    {m.home} vs {m.away}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      komplet
                        ? 'bg-emerald-700/60 text-emerald-100'
                        : m.otypowani > 0
                          ? 'bg-amber-900/40 text-amber-100'
                          : 'bg-emerald-950/60 text-emerald-300/60'
                    }`}
                    title={
                      m.braki.length
                        ? `Brakuje: ${m.braki.join(', ')}`
                        : 'Wszystkie aktywne boty otypowały'
                    }
                  >
                    🤖 {m.otypowani}/{aktywneBoty.length}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PanelWymusCron />
    </main>
  );
}

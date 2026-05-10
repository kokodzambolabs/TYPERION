// Panel botów AI - lista botów + statystyki kosztów + linki do akcji.
// Server Component: pobiera boty z profiles + agregaty z ai_typing_logs.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { formatPromptType } from '@/lib/format';
import Button from '@/components/Button';
import PrzyciskUtworzBoty from './PrzyciskUtworzBoty';
import PrzelacznikBota from './PrzelacznikBota';

export default async function BotyAIPage() {
  // Walidacja admina przez zwykłą sesję (RLS), ale agregaty ciągniemy
  // przez service_role - inaczej polityka predictions_select_own_or_after_kickoff
  // ukrywa typy botów na nadchodzące mecze i licznik pokazuje "0 typów".
  const supabase = await createClient();
  const sb = utworzKlientaServiceRole();

  const { data: boty } = await supabase
    .from('profiles')
    .select('id, nick, ai_provider, ai_model, ai_prompt_type, bot_active, created_at')
    .eq('is_bot', true)
    .order('created_at', { ascending: true });

  const botIds = (boty || []).map((b) => b.id);

  const { data: logi } = botIds.length
    ? await sb
        .from('ai_typing_logs')
        .select('user_id, cost_usd, error')
        .in('user_id', botIds)
    : { data: [] };

  const { data: typy } = botIds.length
    ? await sb.from('predictions').select('user_id').in('user_id', botIds)
    : { data: [] };

  const stats = new Map(); // botId -> { calls, errors, cost, predictions }
  for (const b of boty || []) {
    stats.set(b.id, { calls: 0, errors: 0, cost: 0, predictions: 0 });
  }
  for (const l of logi || []) {
    const s = stats.get(l.user_id);
    if (!s) continue;
    s.calls++;
    if (l.error) s.errors++;
    s.cost += Number(l.cost_usd || 0);
  }
  for (const t of typy || []) {
    const s = stats.get(t.user_id);
    if (!s) continue;
    s.predictions++;
  }

  const lacznyKoszt = (boty || []).reduce(
    (sum, b) => sum + (stats.get(b.id)?.cost || 0),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">🤖 Boty AI</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Konta AI typujące mecze. Cron co godzinę typuje mecze startujące
            za 60–90 min; można też wygenerować ręcznie.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">← Wróć do panelu</Button>
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-emerald-50">
            Lista botów ({boty?.length ?? 0})
          </h2>
          <PrzyciskUtworzBoty istniejaceNicki={(boty || []).map((b) => b.nick)} />
        </div>

        {(!boty || boty.length === 0) ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            Brak botów. Utwórz boty domyślne klikając „🤖 Utwórz domyślne boty”.
          </p>
        ) : (
          <ul className="space-y-2">
            {boty.map((b) => {
              const s = stats.get(b.id) || {
                calls: 0,
                errors: 0,
                cost: 0,
                predictions: 0,
              };
              const aktywny = b.bot_active !== false;
              return (
                <li
                  key={b.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 ${
                    aktywny
                      ? 'border-emerald-900/40 bg-emerald-950/40'
                      : 'border-rose-900/40 bg-rose-950/20 opacity-80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-50">
                        {b.nick}
                      </span>
                      {!aktywny && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-200">
                          Wyłączony
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-emerald-200/70">
                      <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 font-mono">
                        {b.ai_model || '—'}
                      </span>{' '}
                      <span className="ml-1">
                        {formatPromptType(b.ai_prompt_type)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-emerald-200/80 sm:text-right">
                    <div>
                      <strong className="font-mono text-emerald-50">
                        {s.predictions}
                      </strong>{' '}
                      typów zapisanych
                    </div>
                    <div>
                      <span className="font-mono text-emerald-50">
                        {s.calls}
                      </span>{' '}
                      wywołań API{' '}
                      <span
                        className={
                          s.errors > 0 ? 'text-rose-300' : 'text-emerald-300/70'
                        }
                      >
                        ({s.errors} błędów)
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-emerald-50">
                        ${s.cost.toFixed(4)}
                      </span>{' '}
                      kosztów
                    </div>
                  </div>
                  <PrzelacznikBota botId={b.id} aktywny={aktywny} />
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-4 py-3">
          <span className="text-sm text-emerald-200/80">
            Łączny koszt wszystkich botów:{' '}
          </span>
          <span className="font-mono text-base font-bold text-emerald-50">
            ${lacznyKoszt.toFixed(4)}
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/boty-ai/generuj"
          className="group rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5 transition hover:border-emerald-500/60 hover:bg-emerald-800/30"
        >
          <h3 className="mb-1 text-lg font-bold text-emerald-50 group-hover:text-emerald-200">
            ⚡ Wygeneruj typy
          </h3>
          <p className="text-sm text-emerald-200/70">
            Wybierz mecze i odpal wszystkie boty naraz.
          </p>
        </Link>
        <Link
          href="/admin/boty-ai/diagnostyka-cron"
          className="group rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5 transition hover:border-emerald-500/60 hover:bg-emerald-800/30"
        >
          <h3 className="mb-1 text-lg font-bold text-emerald-50 group-hover:text-emerald-200">
            🩺 Diagnostyka cron-a
          </h3>
          <p className="text-sm text-emerald-200/70">
            Stan automatu: nadchodzące mecze, ostatnia aktywność, „Wymuś teraz”.
          </p>
        </Link>
        <Link
          href="/admin/boty-ai/logi"
          className="group rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-5 transition hover:border-emerald-500/60 hover:bg-emerald-800/30"
        >
          <h3 className="mb-1 text-lg font-bold text-emerald-50 group-hover:text-emerald-200">
            📊 Logi AI
          </h3>
          <p className="text-sm text-emerald-200/70">
            Historia wywołań, tokenów, kosztów i błędów.
          </p>
        </Link>
      </section>
    </main>
  );
}

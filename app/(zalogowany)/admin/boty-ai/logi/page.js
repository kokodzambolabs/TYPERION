// Logi wywołań AI - tabela z filtrowaniem (bot/status) przez query string.
// Server Component. Filtrowanie robimy po stronie SQL, sort malejąco po dacie.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/Button';

export default async function LogiAIPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const botFiltr = typeof sp.bot === 'string' ? sp.bot : '';
  const statusFiltr = typeof sp.status === 'string' ? sp.status : ''; // '', 'ok', 'err'

  const supabase = await createClient();

  const { data: boty } = await supabase
    .from('profiles')
    .select('id, nick')
    .eq('is_bot', true)
    .order('created_at', { ascending: true });

  let q = supabase
    .from('ai_typing_logs')
    .select(
      `
        id, user_id, match_id, ai_provider, ai_model, prompt_type,
        parsed_home, parsed_away, tokens_input, tokens_output,
        cost_usd, error, created_at
      `,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (botFiltr) q = q.eq('user_id', botFiltr);
  if (statusFiltr === 'ok') q = q.is('error', null);
  if (statusFiltr === 'err') q = q.not('error', 'is', null);

  const { data: logi } = await q;

  // Mapy do podpinania nicka i drużyn meczu (osobne SELECT-y - tych
  // relacji Supabase nie zna z FK).
  const botMap = new Map((boty || []).map((b) => [b.id, b.nick]));

  const matchIds = Array.from(
    new Set((logi || []).map((l) => l.match_id).filter(Boolean)),
  );
  let matchMap = new Map();
  if (matchIds.length > 0) {
    const { data: mecze } = await supabase
      .from('matches')
      .select(
        `
          id, kickoff_at, competition_code,
          home_team:home_team_id ( name ),
          away_team:away_team_id ( name )
        `,
      )
      .in('id', matchIds);
    matchMap = new Map(
      (mecze || []).map((m) => [
        m.id,
        {
          home: m.home_team?.name || `#${m.id}`,
          away: m.away_team?.name || `#${m.id}`,
          kickoff: m.kickoff_at,
        },
      ]),
    );
  }

  const lacznyKoszt = (logi || []).reduce(
    (s, l) => s + Number(l.cost_usd || 0),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">📊 Logi AI</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Ostatnie 200 wywołań · łączny koszt z tej listy:{' '}
            <strong className="font-mono text-emerald-50">
              ${lacznyKoszt.toFixed(4)}
            </strong>
          </p>
        </div>
        <Link href="/admin/boty-ai">
          <Button variant="secondary">← Wróć</Button>
        </Link>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-4">
        <label className="text-sm">
          <span className="mb-1 block text-emerald-200/80">Bot</span>
          <select
            name="bot"
            defaultValue={botFiltr}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-2 text-emerald-50 outline-none focus:border-emerald-400"
          >
            <option value="">Wszystkie</option>
            {(boty || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nick}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-emerald-200/80">Status</span>
          <select
            name="status"
            defaultValue={statusFiltr}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-2 text-emerald-50 outline-none focus:border-emerald-400"
          >
            <option value="">Wszystkie</option>
            <option value="ok">Sukces</option>
            <option value="err">Błąd</option>
          </select>
        </label>
        <Button type="submit">Filtruj</Button>
        {(botFiltr || statusFiltr) && (
          <Link
            href="/admin/boty-ai/logi"
            className="text-sm text-emerald-300 underline hover:text-emerald-200"
          >
            wyczyść
          </Link>
        )}
      </form>

      {!logi || logi.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak logów dla tych filtrów.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-emerald-900/40 bg-emerald-900/10">
          <table className="w-full min-w-[900px] text-left text-xs text-emerald-100">
            <thead className="bg-emerald-900/40 text-[11px] uppercase tracking-wide text-emerald-200/80">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Bot</th>
                <th className="px-3 py-2">Mecz</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2 text-right">Tokeny in/out</th>
                <th className="px-3 py-2 text-right">Koszt</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logi.map((l) => {
                const m = matchMap.get(l.match_id);
                const ok = !l.error;
                return (
                  <tr
                    key={l.id}
                    className="border-t border-emerald-900/30 align-top"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-emerald-200/80">
                      {new Date(l.created_at).toLocaleString('pl-PL', {
                        timeZone: 'Europe/Warsaw',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">
                        {botMap.get(l.user_id) || '—'}
                      </div>
                      <div className="text-emerald-300/70">
                        {l.ai_model}{' '}
                        <span className="text-emerald-300/50">
                          · {l.prompt_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {m ? (
                        <>
                          <div>
                            {m.home} vs {m.away}
                          </div>
                          <div className="text-emerald-300/60">
                            #{l.match_id}
                          </div>
                        </>
                      ) : (
                        <span className="text-emerald-300/60">
                          #{l.match_id}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.parsed_home != null && l.parsed_away != null ? (
                        <span className="font-mono text-emerald-50">
                          {l.parsed_home}:{l.parsed_away}
                        </span>
                      ) : (
                        <span className="text-emerald-300/60">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-emerald-200/80">
                      {(l.tokens_input ?? 0).toLocaleString('pl-PL')} /{' '}
                      {(l.tokens_output ?? 0).toLocaleString('pl-PL')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-emerald-50">
                      ${Number(l.cost_usd || 0).toFixed(4)}
                    </td>
                    <td className="px-3 py-2">
                      {ok ? (
                        <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                          ✓ OK
                        </span>
                      ) : (
                        <span
                          className="block max-w-xs truncate rounded bg-rose-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-rose-100"
                          title={l.error}
                        >
                          ✗ {l.error}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

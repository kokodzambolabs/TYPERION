// Lista pytań bonusowych z filtrami "Wszystkie / Nierozliczone / Rozliczone".
// Status pytania = settled (is_settled=true) | closed (po bonuses_close_at) | open.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/Button';
import KartaPytaniaAdmin from '@/components/KartaPytaniaAdmin';

export default async function BonusyAdminPage({ searchParams }) {
  // searchParams jest Promise w Next.js 16.
  const sp = await searchParams;
  const filtr = sp?.filtr || 'wszystkie';

  const supabase = await createClient();

  const [{ data: pytania }, { data: settings }] = await Promise.all([
    supabase
      .from('bonus_questions')
      .select(
        'id, text, description, question_type, max_points, order_index, is_settled, correct_team_id, correct_boolean, correct_answer',
      )
      .order('order_index', { ascending: true }),
    supabase
      .from('tournament_settings')
      .select('bonuses_close_at')
      .eq('id', 1)
      .single(),
  ]);

  const statusBonusow =
    settings && new Date(settings.bonuses_close_at) <= new Date() ? 'closed' : 'open';

  // Liczba odpowiedzi per pytanie - jedno zapytanie i grupowanie w JS.
  const liczbyOdp = {};
  if (pytania && pytania.length > 0) {
    const ids = pytania.map((p) => p.id);
    const { data: wszystkieOdp } = await supabase
      .from('bonus_answers')
      .select('question_id')
      .in('question_id', ids);
    for (const o of wszystkieOdp || []) {
      liczbyOdp[o.question_id] = (liczbyOdp[o.question_id] || 0) + 1;
    }
  }

  let lista = pytania || [];
  if (filtr === 'rozliczone') lista = lista.filter((p) => p.is_settled);
  else if (filtr === 'nierozliczone') lista = lista.filter((p) => !p.is_settled);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-emerald-50">Pytania bonusowe</h1>
        <Link href="/admin/bonusy/nowe">
          <Button variant="primary">+ Nowe pytanie</Button>
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <FiltrLink href="/admin/bonusy" active={filtr === 'wszystkie'}>
          Wszystkie
        </FiltrLink>
        <FiltrLink
          href="/admin/bonusy?filtr=nierozliczone"
          active={filtr === 'nierozliczone'}
        >
          Nierozliczone
        </FiltrLink>
        <FiltrLink
          href="/admin/bonusy?filtr=rozliczone"
          active={filtr === 'rozliczone'}
        >
          Rozliczone
        </FiltrLink>
      </div>

      {!pytania || pytania.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak pytań bonusowych. Dodaj pierwsze pytanie.
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak pytań w wybranym filtrze.
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.id}>
              <KartaPytaniaAdmin
                pytanie={p}
                statusBonusow={statusBonusow}
                liczbaOdpowiedzi={liczbyOdp[p.id] ?? 0}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FiltrLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 transition ${
        active
          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
          : 'border-emerald-800/60 bg-emerald-900/20 text-emerald-200/80 hover:border-emerald-500/40 hover:text-emerald-100'
      }`}
    >
      {children}
    </Link>
  );
}

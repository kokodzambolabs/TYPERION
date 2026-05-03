// Strona dla zalogowanego usera - pytania bonusowe.
// Przed bonuses_close_at: formularz (FormularzBonusow, client) z zapisem per pytanie.
// Po zamknięciu: tryb tylko-do-odczytu z punktami i poprawnymi odpowiedziami.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FormularzBonusow from '@/components/FormularzBonusow';
import { formatujDateKrotkoPL } from '@/lib/format';

export default async function BonusyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/logowanie');

  const [{ data: settings }, { data: pytania }, { data: teams }, { data: odpowiedzi }] =
    await Promise.all([
      supabase
        .from('tournament_settings')
        .select('bonuses_close_at, tournament_name')
        .eq('id', 1)
        .single(),
      supabase
        .from('bonus_questions')
        .select(
          'id, text, description, question_type, max_points, order_index, is_settled, correct_team_id, correct_boolean, correct_answer',
        )
        .order('order_index', { ascending: true }),
      supabase.from('teams').select('id, name').order('name', { ascending: true }),
      supabase
        .from('bonus_answers')
        .select('id, question_id, answer_team_id, answer_boolean, answer_text, points')
        .eq('user_id', user.id),
    ]);

  const closeAt = settings?.bonuses_close_at ? new Date(settings.bonuses_close_at) : null;
  const isOpen = !!closeAt && closeAt.getTime() > new Date().getTime();

  const odpMap = {};
  for (const o of odpowiedzi || []) odpMap[o.question_id] = o;

  if (!pytania || pytania.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-emerald-50">Bonusy</h1>
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          <p className="text-lg font-semibold text-emerald-100">Brak pytań bonusowych</p>
          <p className="mt-1 text-sm">Admin jeszcze ich nie dodał.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="mb-4 text-3xl font-bold text-emerald-50">Bonusy</h1>

      {isOpen ? (
        <BannerOtwarte closeAt={closeAt} />
      ) : (
        <BannerZamkniete />
      )}

      {isOpen ? (
        <FormularzBonusow
          questions={pytania}
          userAnswers={odpMap}
          teams={teams || []}
          isOpen={true}
        />
      ) : (
        <ListaTylkoOdczyt
          pytania={pytania}
          odpowiedzi={odpMap}
          teams={teams || []}
        />
      )}
    </main>
  );
}

function BannerOtwarte({ closeAt }) {
  const teraz = new Date().getTime();
  const ms = closeAt.getTime() - teraz;
  const dni = Math.floor(ms / (24 * 60 * 60 * 1000));
  const godziny = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  return (
    <div className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-100">
      <p className="font-semibold">
        Bonusy zamykają się za {dni} {dni === 1 ? 'dzień' : 'dni'} {godziny}{' '}
        {godziny === 1 ? 'godzinę' : 'godzin'}.
      </p>
      <p className="text-sm text-emerald-200/70">
        Zamknięcie: {formatujDateKrotkoPL(closeAt)}. Odpowiedzi możesz zmieniać do tej daty.
      </p>
    </div>
  );
}

function BannerZamkniete() {
  return (
    <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100">
      <p className="font-semibold">Bonusy zamknięte. Twoje odpowiedzi:</p>
    </div>
  );
}

function ListaTylkoOdczyt({ pytania, odpowiedzi, teams }) {
  const teamNazwa = (id) => teams.find((t) => t.id === id)?.name || `#${id}`;
  return (
    <ul className="space-y-3">
      {pytania.map((p) => {
        const odp = odpowiedzi[p.id];
        const userOdp = formatujOdpowiedz(p, odp, teamNazwa);
        const correct = formatujPoprawna(p, teamNazwa);
        return (
          <li
            key={p.id}
            className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 p-4"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-emerald-50">{p.text}</h3>
              <span className="text-xs text-emerald-300/70">{p.max_points} pkt</span>
            </div>
            {p.description && (
              <p className="mb-2 text-sm text-emerald-200/70">{p.description}</p>
            )}
            <dl className="space-y-1 text-sm text-emerald-100">
              <div className="flex flex-wrap gap-2">
                <dt className="text-emerald-300/70">Twoja odpowiedź:</dt>
                <dd className="font-mono">{userOdp ?? '—'}</dd>
              </div>
              {p.is_settled && (
                <>
                  {correct && (
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-emerald-300/70">Poprawna:</dt>
                      <dd className="font-mono">{correct}</dd>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-emerald-300/70">Punkty:</dt>
                    <dd className="font-semibold">
                      {odp?.points ?? 0} / {p.max_points}
                    </dd>
                  </div>
                </>
              )}
              {!p.is_settled && (
                <p className="text-xs text-emerald-300/60">
                  Czeka na rozliczenie.
                </p>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function formatujOdpowiedz(pytanie, odp, teamNazwa) {
  if (!odp) return null;
  if (pytanie.question_type === 'team') {
    return odp.answer_team_id ? teamNazwa(odp.answer_team_id) : null;
  }
  if (pytanie.question_type === 'boolean') {
    if (odp.answer_boolean === true) return 'Tak';
    if (odp.answer_boolean === false) return 'Nie';
    return null;
  }
  return odp.answer_text || null;
}

function formatujPoprawna(pytanie, teamNazwa) {
  if (pytanie.question_type === 'team') {
    return pytanie.correct_team_id ? teamNazwa(pytanie.correct_team_id) : null;
  }
  if (pytanie.question_type === 'boolean') {
    if (pytanie.correct_boolean === true) return 'Tak';
    if (pytanie.correct_boolean === false) return 'Nie';
    return null;
  }
  return pytanie.correct_answer || null;
}

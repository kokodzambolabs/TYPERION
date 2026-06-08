// Strona dla zalogowanego usera - pytania bonusowe.
// Przed bonuses_close_at: formularz (FormularzBonusow, client) z zapisem per pytanie.
// Po zamknięciu: tryb tylko-do-odczytu z punktami i poprawnymi odpowiedziami.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FormularzBonusow from '@/components/FormularzBonusow';
import ListaBonusowOdczyt from '@/components/ListaBonusowOdczyt';
import { formatujDateKrotkoPL } from '@/lib/format';

export default async function BonusyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/logowanie');

  const [
    { data: settings },
    { data: pytania },
    { data: teams },
    { data: odpowiedzi },
    { data: opcje },
  ] = await Promise.all([
    supabase
      .from('tournament_settings')
      .select('bonuses_close_at, tournament_name')
      .eq('id', 1)
      .single(),
    supabase
      .from('bonus_questions')
      .select(
        'id, text, description, question_type, max_points, order_index, is_settled, correct_team_id, correct_boolean, correct_answer, team_group',
      )
      .order('order_index', { ascending: true }),
    supabase
      .from('teams')
      .select('id, name, group_in_tournament')
      .order('name', { ascending: true }),
    supabase
      .from('bonus_answers')
      .select(
        'id, question_id, answer_team_id, answer_boolean, answer_text, points, selected_option_id, answer_other_flag, updated_at',
      )
      .eq('user_id', user.id),
    supabase
      .from('bonus_question_options')
      .select('id, question_id, opcja_text, punkty, kolejnosc, is_correct')
      .order('kolejnosc', { ascending: true }),
  ]);

  // Grupowanie opcji per pytanie - przyda się i w formularzu, i w trybie odczytu.
  const opcjeMap = {};
  for (const o of opcje || []) {
    if (!opcjeMap[o.question_id]) opcjeMap[o.question_id] = [];
    opcjeMap[o.question_id].push(o);
  }

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
          opcjeMap={opcjeMap}
          isOpen={true}
        />
      ) : (
        <ListaBonusowOdczyt
          pytania={pytania}
          odpowiedzi={odpMap}
          teams={teams || []}
          opcjeMap={opcjeMap}
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


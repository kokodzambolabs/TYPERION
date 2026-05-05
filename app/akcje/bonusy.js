'use server';

// Server Actions dla pytań bonusowych (panel admina /admin/bonusy).
// Pytania, poprawne odpowiedzi, automatyczne i ręczne rozliczanie.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

const TYPY = ['team', 'boolean', 'text', 'number'];
// MŚ 2026 — 48 drużyn w 12 grupach (A–L), nie 8 jak w starszych edycjach.
const GRUPY_MS = [
  'GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D',
  'GROUP_E', 'GROUP_F', 'GROUP_G', 'GROUP_H',
  'GROUP_I', 'GROUP_J', 'GROUP_K', 'GROUP_L',
];

const SchematPytania = z
  .object({
    text: z
      .string()
      .trim()
      .min(3, { message: 'Pytanie musi mieć minimum 3 znaki.' })
      .max(500, { message: 'Pytanie max 500 znaków.' }),
    description: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    question_type: z.enum(TYPY, { message: 'Nieprawidłowy typ pytania.' }),
    max_points: z.coerce
      .number()
      .int()
      .min(1, { message: 'Punkty muszą być min. 1.' })
      .max(1000, { message: 'Punkty max 1000.' }),
    order_index: z.coerce.number().int().min(0).default(0),
    team_group: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null))
      .refine((v) => v === null || GRUPY_MS.includes(v), {
        message: 'Nieprawidłowa grupa.',
      }),
  })
  // team_group ma sens tylko dla pytań typu 'team' - dla innych typów
  // wymuszamy null, żeby nie zostało po zmianie typu pytania.
  .transform((v) =>
    v.question_type === 'team' ? v : { ...v, team_group: null },
  );

function parsujPytanie(formData) {
  return SchematPytania.safeParse({
    text: formData.get('text') ?? '',
    description: formData.get('description') ?? '',
    question_type: formData.get('question_type'),
    max_points: formData.get('max_points'),
    order_index: formData.get('order_index') ?? 0,
    team_group: formData.get('team_group') ?? null,
  });
}

export async function dodajPytanie(_prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = parsujPytanie(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await auth.supabase.from('bonus_questions').insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath('/admin/bonusy');
  revalidatePath('/admin');
  redirect('/admin/bonusy');
}

export async function edytujPytanie(id, _prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const pytanieId = Number(id);
  if (!pytanieId) return { error: 'Nieprawidłowy identyfikator pytania.' };

  const parsed = parsujPytanie(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await auth.supabase
    .from('bonus_questions')
    .update(parsed.data)
    .eq('id', pytanieId);
  if (error) return { error: error.message };

  revalidatePath('/admin/bonusy');
  revalidatePath(`/admin/bonusy/${pytanieId}/edycja`);
  return { ok: 'Pytanie zaktualizowane.' };
}

export async function usunPytanie(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const pytanieId = Number(id);
  if (!pytanieId) return { error: 'Nieprawidłowy identyfikator pytania.' };

  // bonus_answers kasują się kaskadowo (FK ON DELETE CASCADE).
  const { error } = await auth.supabase
    .from('bonus_questions')
    .delete()
    .eq('id', pytanieId);
  if (error) return { error: error.message };

  revalidatePath('/admin/bonusy');
  revalidatePath('/admin');
  return { ok: true };
}

// ----- Poprawne odpowiedzi i rozliczanie -----

const SchematPoprawnejOdp = z.object({
  question_type: z.enum(TYPY),
  correct_team_id: z.coerce.number().int().positive().nullable().optional(),
  correct_boolean: z
    .enum(['true', 'false'])
    .nullable()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : null)),
  correct_answer: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function zapiszPoprawnaOdpowiedz(id, _prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const pytanieId = Number(id);
  if (!pytanieId) return { error: 'Nieprawidłowy identyfikator pytania.' };

  const parsed = SchematPoprawnejOdp.safeParse({
    question_type: formData.get('question_type'),
    correct_team_id: formData.get('correct_team_id') || null,
    correct_boolean: formData.get('correct_boolean') || null,
    correct_answer: formData.get('correct_answer') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const update = {
    correct_team_id: null,
    correct_boolean: null,
    correct_answer: null,
  };
  if (parsed.data.question_type === 'team') {
    if (!parsed.data.correct_team_id) return { error: 'Wybierz drużynę.' };
    // Jeśli pytanie ma filtr grupy - sprawdź czy wybrana drużyna do niej należy.
    const { data: pytanie } = await auth.supabase
      .from('bonus_questions')
      .select('team_group')
      .eq('id', pytanieId)
      .single();
    if (pytanie?.team_group) {
      const { data: team } = await auth.supabase
        .from('teams')
        .select('group_in_tournament')
        .eq('id', parsed.data.correct_team_id)
        .single();
      if (!team || team.group_in_tournament !== pytanie.team_group) {
        return { error: 'Wybrana drużyna nie należy do filtrowanej grupy.' };
      }
    }
    update.correct_team_id = parsed.data.correct_team_id;
  } else if (parsed.data.question_type === 'boolean') {
    if (parsed.data.correct_boolean === null) return { error: 'Wybierz Tak lub Nie.' };
    update.correct_boolean = parsed.data.correct_boolean;
  } else {
    if (!parsed.data.correct_answer) return { error: 'Wpisz poprawną odpowiedź.' };
    update.correct_answer = parsed.data.correct_answer;
  }

  const { error } = await auth.supabase
    .from('bonus_questions')
    .update(update)
    .eq('id', pytanieId);
  if (error) return { error: error.message };

  revalidatePath('/admin/bonusy');
  revalidatePath(`/admin/bonusy/${pytanieId}/edycja`);
  revalidatePath(`/admin/bonusy/${pytanieId}/rozlicz`);
  return { ok: 'Poprawna odpowiedź zapisana.' };
}

export async function rozliczAutomatycznie(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const pytanieId = Number(id);
  if (!pytanieId) return { error: 'Nieprawidłowy identyfikator pytania.' };

  const { data: pytanie, error: pytE } = await auth.supabase
    .from('bonus_questions')
    .select('id, question_type, max_points, correct_team_id, correct_boolean')
    .eq('id', pytanieId)
    .single();
  if (pytE || !pytanie) return { error: pytE?.message || 'Pytanie nie istnieje.' };

  if (pytanie.question_type !== 'team' && pytanie.question_type !== 'boolean') {
    return { error: 'Automatyczne rozliczanie tylko dla pytań typu drużyna lub Tak/Nie.' };
  }
  if (pytanie.question_type === 'team' && !pytanie.correct_team_id) {
    return { error: 'Najpierw wpisz poprawną odpowiedź (drużynę).' };
  }
  if (pytanie.question_type === 'boolean' && pytanie.correct_boolean === null) {
    return { error: 'Najpierw wpisz poprawną odpowiedź (Tak/Nie).' };
  }

  const { data: odpowiedzi, error: oE } = await auth.supabase
    .from('bonus_answers')
    .select('id, answer_team_id, answer_boolean')
    .eq('question_id', pytanieId);
  if (oE) return { error: oE.message };

  // Aktualizujemy każdą odpowiedź osobno - PostgREST nie ma bulk UPDATE
  // z różnymi wartościami per wiersz. Dla bonusów to akceptowalne (rzadkie,
  // mała liczba odpowiedzi).
  for (const odp of odpowiedzi || []) {
    const pasuje =
      pytanie.question_type === 'team'
        ? odp.answer_team_id === pytanie.correct_team_id
        : odp.answer_boolean === pytanie.correct_boolean;
    const punkty = pasuje ? pytanie.max_points : 0;
    const { error } = await auth.supabase
      .from('bonus_answers')
      .update({ points: punkty, updated_at: new Date().toISOString() })
      .eq('id', odp.id);
    if (error) return { error: `Błąd przy odpowiedzi #${odp.id}: ${error.message}` };
  }

  await auth.supabase
    .from('bonus_questions')
    .update({ is_settled: true })
    .eq('id', pytanieId);

  revalidatePath('/admin/bonusy');
  revalidatePath(`/admin/bonusy/${pytanieId}/edycja`);
  return { ok: `Rozliczono ${odpowiedzi?.length ?? 0} odpowiedzi.` };
}

export async function zapiszPunktyOdpowiedzi(id, lista) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const pytanieId = Number(id);
  if (!pytanieId) return { error: 'Nieprawidłowy identyfikator pytania.' };
  if (!Array.isArray(lista)) return { error: 'Brak listy odpowiedzi.' };

  for (const wpis of lista) {
    const answerId = Number(wpis?.answerId);
    const points = Number(wpis?.points);
    if (!answerId || Number.isNaN(points)) continue;

    const { error } = await auth.supabase
      .from('bonus_answers')
      .update({ points, updated_at: new Date().toISOString() })
      .eq('id', answerId)
      .eq('question_id', pytanieId);
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/bonusy');
  revalidatePath(`/admin/bonusy/${pytanieId}/rozlicz`);
  return { ok: 'Punkty zapisane.' };
}

// ----- Odpowiedź usera na pytanie bonusowe -----

const SchematOdpowiedzi = z.object({
  questionId: z.coerce.number().int().positive({ message: 'Nieprawidłowe pytanie.' }),
  answerTeamId: z.coerce.number().int().positive().nullable().optional(),
  answerBoolean: z
    .enum(['true', 'false'])
    .nullable()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : null)),
  answerText: z
    .string()
    .trim()
    .max(200, { message: 'Odpowiedź max 200 znaków.' })
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function zapiszOdpowiedzBonusowa(_prev, formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  const parsed = SchematOdpowiedzi.safeParse({
    questionId: formData.get('questionId'),
    answerTeamId: formData.get('answerTeamId') || null,
    answerBoolean: formData.get('answerBoolean') || null,
    answerText: formData.get('answerText') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: pytanie, error: pytE } = await supabase
    .from('bonus_questions')
    .select('id, question_type, team_group')
    .eq('id', parsed.data.questionId)
    .single();
  if (pytE || !pytanie) return { error: 'Pytanie nie istnieje.' };

  const { data: settings, error: sE } = await supabase
    .from('tournament_settings')
    .select('bonuses_close_at')
    .eq('id', 1)
    .single();
  if (sE || !settings) return { error: 'Brak ustawień turnieju.' };
  if (new Date(settings.bonuses_close_at) <= new Date()) {
    return { error: 'Bonusy zamknięte.' };
  }

  // Walidacja zależnie od typu - tylko jedno z answer_* pól ma być wypełnione.
  const wpis = {
    user_id: user.id,
    question_id: parsed.data.questionId,
    answer_team_id: null,
    answer_boolean: null,
    answer_text: null,
    updated_at: new Date().toISOString(),
  };
  if (pytanie.question_type === 'team') {
    if (!parsed.data.answerTeamId) return { error: 'Wybierz drużynę.' };
    // RLS nie egzekwuje team_group - musimy to sprawdzić sami,
    // żeby user nie mógł obejść filtra przez własny POST.
    if (pytanie.team_group) {
      const { data: team } = await supabase
        .from('teams')
        .select('group_in_tournament')
        .eq('id', parsed.data.answerTeamId)
        .single();
      if (!team || team.group_in_tournament !== pytanie.team_group) {
        return { error: 'Wybrana drużyna nie należy do filtrowanej grupy.' };
      }
    }
    wpis.answer_team_id = parsed.data.answerTeamId;
  } else if (pytanie.question_type === 'boolean') {
    if (parsed.data.answerBoolean === null) return { error: 'Wybierz Tak lub Nie.' };
    wpis.answer_boolean = parsed.data.answerBoolean;
  } else if (pytanie.question_type === 'number') {
    if (!parsed.data.answerText) return { error: 'Wpisz liczbę.' };
    if (Number.isNaN(Number(parsed.data.answerText))) {
      return { error: 'Odpowiedź musi być liczbą.' };
    }
    wpis.answer_text = parsed.data.answerText;
  } else {
    if (!parsed.data.answerText) return { error: 'Wpisz odpowiedź.' };
    wpis.answer_text = parsed.data.answerText;
  }

  const { error } = await supabase
    .from('bonus_answers')
    .upsert(wpis, { onConflict: 'user_id,question_id' });
  if (error) return { error: error.message };

  revalidatePath('/bonusy');
  // savedAt jako klucz do flash animacji - bez tego key={state} nie zmienia się
  // między kolejnymi udanymi zapisami i animacja odpala się tylko raz.
  return { ok: 'Zapisano.', savedAt: Date.now() };
}

export async function oznaczPytanieRozliczone(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const pytanieId = Number(id);
  if (!pytanieId) return { error: 'Nieprawidłowy identyfikator pytania.' };

  const { error } = await auth.supabase
    .from('bonus_questions')
    .update({ is_settled: true })
    .eq('id', pytanieId);
  if (error) return { error: error.message };

  revalidatePath('/admin/bonusy');
  revalidatePath(`/admin/bonusy/${pytanieId}/rozlicz`);
  revalidatePath(`/admin/bonusy/${pytanieId}/edycja`);
  return { ok: 'Pytanie oznaczone jako rozliczone.' };
}

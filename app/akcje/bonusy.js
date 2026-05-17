'use server';

// Server Actions dla pytań bonusowych (panel admina /admin/bonusy).
// Pytania, opcje (dla typów ważonych), poprawne odpowiedzi, automatyczne
// i ręczne rozliczanie.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

const TYPY = [
  'team',
  'boolean',
  'text',
  'number',
  'dropdown_weighted',
  'boolean_weighted',
  'dropdown_other',
];

// Typy ważone — punktacja per OPCJA (bonus_question_options.punkty),
// nie per pytanie (bonus_questions.max_points zostaje tylko dla kompat.).
const TYPY_WAZONE = ['dropdown_weighted', 'boolean_weighted', 'dropdown_other'];

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

  // bonus_answers i bonus_question_options kasują się kaskadowo
  // (FK ON DELETE CASCADE).
  const { error } = await auth.supabase
    .from('bonus_questions')
    .delete()
    .eq('id', pytanieId);
  if (error) return { error: error.message };

  revalidatePath('/admin/bonusy');
  revalidatePath('/admin');
  return { ok: true };
}

// ----- Opcje pytań ważonych (bonus_question_options) -----

const SchematOpcji = z.object({
  opcja_text: z
    .string()
    .trim()
    .min(1, { message: 'Tekst opcji nie może być pusty.' })
    .max(200, { message: 'Tekst opcji max 200 znaków.' }),
  punkty: z.coerce
    .number()
    .int()
    .min(0, { message: 'Punkty min 0.' })
    .max(1000, { message: 'Punkty max 1000.' }),
  kolejnosc: z.coerce.number().int().min(0).default(0),
});

export async function dodajOpcje(pytanieId, _prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const qId = Number(pytanieId);
  if (!qId) return { error: 'Nieprawidłowy identyfikator pytania.' };

  const parsed = SchematOpcji.safeParse({
    opcja_text: formData.get('opcja_text') ?? '',
    punkty: formData.get('punkty') ?? 0,
    kolejnosc: formData.get('kolejnosc') ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await auth.supabase
    .from('bonus_question_options')
    .insert({ question_id: qId, ...parsed.data });
  if (error) return { error: error.message };

  revalidatePath(`/admin/bonusy/${qId}/edycja`);
  return { ok: 'Opcja dodana.' };
}

export async function edytujOpcje(opcjaId, _prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const oId = Number(opcjaId);
  if (!oId) return { error: 'Nieprawidłowy identyfikator opcji.' };

  const parsed = SchematOpcji.safeParse({
    opcja_text: formData.get('opcja_text') ?? '',
    punkty: formData.get('punkty') ?? 0,
    kolejnosc: formData.get('kolejnosc') ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: opcja, error: opcjaE } = await auth.supabase
    .from('bonus_question_options')
    .update(parsed.data)
    .eq('id', oId)
    .select('question_id')
    .single();
  if (opcjaE) return { error: opcjaE.message };

  if (opcja?.question_id) {
    revalidatePath(`/admin/bonusy/${opcja.question_id}/edycja`);
  }
  return { ok: 'Opcja zaktualizowana.' };
}

// Zapis punktów dla pojedynczej opcji (inline edit z panelu admina).
// Wywoływany z useTransition na karcie opcji - przyjmuje liczbę.
export async function zapiszPunktyOpcji(opcjaId, punkty) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const oId = Number(opcjaId);
  const pkt = Number(punkty);
  if (!oId) return { error: 'Nieprawidłowy identyfikator opcji.' };
  if (!Number.isFinite(pkt) || pkt < 0 || pkt > 1000) {
    return { error: 'Punkty muszą być w zakresie 0–1000.' };
  }

  const { data: opcja, error } = await auth.supabase
    .from('bonus_question_options')
    .update({ punkty: pkt })
    .eq('id', oId)
    .select('question_id')
    .single();
  if (error) return { error: error.message };

  if (opcja?.question_id) {
    revalidatePath(`/admin/bonusy/${opcja.question_id}/edycja`);
  }
  return { ok: 'Zapisano.' };
}

export async function usunOpcje(opcjaId) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const oId = Number(opcjaId);
  if (!oId) return { error: 'Nieprawidłowy identyfikator opcji.' };

  // bonus_answers.selected_option_id leci na NULL (FK SET NULL),
  // odpowiedzi userów zostają - admin może je obejrzeć / rozliczyć ręcznie.
  const { data: opcja, error: getE } = await auth.supabase
    .from('bonus_question_options')
    .select('question_id')
    .eq('id', oId)
    .single();
  if (getE) return { error: getE.message };

  const { error } = await auth.supabase
    .from('bonus_question_options')
    .delete()
    .eq('id', oId);
  if (error) return { error: error.message };

  if (opcja?.question_id) {
    revalidatePath(`/admin/bonusy/${opcja.question_id}/edycja`);
  }
  return { ok: true };
}

// Oznacz opcję jako poprawną (resetuje is_correct na innych opcjach
// tego samego pytania - partial unique index pilnuje, że jest max 1).
export async function oznaczOpcjePoprawna(opcjaId) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const oId = Number(opcjaId);
  if (!oId) return { error: 'Nieprawidłowy identyfikator opcji.' };

  const { data: opcja, error: getE } = await auth.supabase
    .from('bonus_question_options')
    .select('question_id')
    .eq('id', oId)
    .single();
  if (getE || !opcja) return { error: getE?.message || 'Opcja nie istnieje.' };

  // Najpierw zerujemy wszystkie - inaczej UNIQUE INDEX (where is_correct=true)
  // odrzuci nasz UPDATE, bo dwa wiersze byłyby chwilowo true.
  const { error: clearE } = await auth.supabase
    .from('bonus_question_options')
    .update({ is_correct: false })
    .eq('question_id', opcja.question_id);
  if (clearE) return { error: clearE.message };

  const { error: setE } = await auth.supabase
    .from('bonus_question_options')
    .update({ is_correct: true })
    .eq('id', oId);
  if (setE) return { error: setE.message };

  revalidatePath(`/admin/bonusy/${opcja.question_id}/edycja`);
  return { ok: 'Oznaczono jako poprawną.' };
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

  // Stare typy team/boolean - prosta logika "trafił -> max_points".
  if (pytanie.question_type === 'team' || pytanie.question_type === 'boolean') {
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

  // Nowe typy ważone: dropdown_weighted, boolean_weighted, dropdown_other.
  // Punktacja idzie z bonus_question_options.punkty wybranej opcji,
  // jeśli ta opcja jest oznaczona is_correct=true.
  // Dla dropdown_other "Inny" (answer_other_flag=true) - rozliczanie RĘCZNE,
  // pomijamy w automacie i admin wpisuje points sam pod /rozlicz.
  if (TYPY_WAZONE.includes(pytanie.question_type)) {
    const { data: opcje, error: opcjeE } = await auth.supabase
      .from('bonus_question_options')
      .select('id, punkty, is_correct')
      .eq('question_id', pytanieId);
    if (opcjeE) return { error: opcjeE.message };

    const poprawne = (opcje || []).filter((o) => o.is_correct);
    if (poprawne.length === 0) {
      return { error: 'Najpierw oznacz poprawną opcję w panelu opcji.' };
    }
    const poprawnaId = poprawne[0].id;
    const punktyZaPoprawna = poprawne[0].punkty ?? 0;

    const { data: odpowiedzi, error: oE } = await auth.supabase
      .from('bonus_answers')
      .select('id, selected_option_id, answer_other_flag')
      .eq('question_id', pytanieId);
    if (oE) return { error: oE.message };

    let rozliczonych = 0;
    let pominietych = 0;
    for (const odp of odpowiedzi || []) {
      // "Inny" zostawiamy adminowi (ręczne rozliczenie).
      if (odp.answer_other_flag) {
        pominietych += 1;
        continue;
      }
      const pasuje = odp.selected_option_id === poprawnaId;
      const punkty = pasuje ? punktyZaPoprawna : 0;
      const { error } = await auth.supabase
        .from('bonus_answers')
        .update({ points: punkty, updated_at: new Date().toISOString() })
        .eq('id', odp.id);
      if (error) return { error: `Błąd przy odpowiedzi #${odp.id}: ${error.message}` };
      rozliczonych += 1;
    }

    // Jeśli są "Inny" do rozliczenia ręcznego - nie zamykamy pytania,
    // admin musi je domknąć po wpisaniu punktów.
    if (pominietych === 0) {
      await auth.supabase
        .from('bonus_questions')
        .update({ is_settled: true })
        .eq('id', pytanieId);
    }

    revalidatePath('/admin/bonusy');
    revalidatePath(`/admin/bonusy/${pytanieId}/edycja`);
    revalidatePath(`/admin/bonusy/${pytanieId}/rozlicz`);
    return {
      ok:
        pominietych > 0
          ? `Rozliczono ${rozliczonych} odpowiedzi. ${pominietych} z odpowiedzią "Inny" — dopisz punkty ręcznie pod „Rozlicz”.`
          : `Rozliczono ${rozliczonych} odpowiedzi.`,
    };
  }

  return {
    error:
      'Automatyczne rozliczanie tylko dla typów: team, boolean, dropdown_weighted, boolean_weighted, dropdown_other.',
  };
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
  selectedOptionId: z.coerce.number().int().positive().nullable().optional(),
  isOther: z
    .enum(['true', 'false'])
    .nullable()
    .optional()
    .transform((v) => v === 'true'),
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
    selectedOptionId: formData.get('selectedOptionId') || null,
    isOther: formData.get('isOther') || null,
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

  const wpis = {
    user_id: user.id,
    question_id: parsed.data.questionId,
    answer_team_id: null,
    answer_boolean: null,
    answer_text: null,
    selected_option_id: null,
    answer_other_flag: false,
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
  } else if (
    pytanie.question_type === 'dropdown_weighted' ||
    pytanie.question_type === 'boolean_weighted'
  ) {
    if (!parsed.data.selectedOptionId) return { error: 'Wybierz odpowiedź.' };
    // Walidujemy, że opcja należy do tego pytania (klient mógłby podstawić cudzą).
    const { data: opcja } = await supabase
      .from('bonus_question_options')
      .select('id, question_id, opcja_text')
      .eq('id', parsed.data.selectedOptionId)
      .single();
    if (!opcja || opcja.question_id !== parsed.data.questionId) {
      return { error: 'Nieprawidłowa opcja.' };
    }
    wpis.selected_option_id = opcja.id;
    wpis.answer_text = opcja.opcja_text; // dla wygody odczytu/rankingu
  } else if (pytanie.question_type === 'dropdown_other') {
    if (parsed.data.isOther) {
      if (!parsed.data.answerText) {
        return { error: 'Wpisz własną odpowiedź dla "Inny".' };
      }
      wpis.answer_other_flag = true;
      wpis.answer_text = parsed.data.answerText;
      wpis.selected_option_id = null;
    } else {
      if (!parsed.data.selectedOptionId) return { error: 'Wybierz odpowiedź.' };
      const { data: opcja } = await supabase
        .from('bonus_question_options')
        .select('id, question_id, opcja_text')
        .eq('id', parsed.data.selectedOptionId)
        .single();
      if (!opcja || opcja.question_id !== parsed.data.questionId) {
        return { error: 'Nieprawidłowa opcja.' };
      }
      wpis.selected_option_id = opcja.id;
      wpis.answer_text = opcja.opcja_text;
    }
  } else {
    // 'text'
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

// Pobiera CUDZE odpowiedzi bonusowe dla pojedynczego pytania - dla sekcji
// "Zobacz odpowiedzi innych" na /bonusy. Wzorowane 1:1 na pobierzCudzeTypy
// z app/akcje/typy.js. Wywoływane lazy: dopiero po kliknięciu togglera,
// żeby nie wisieć z N zapytaniami na liście wszystkich pytań.
//
// Widoczność rządzi się tournament_settings.bonuses_close_at:
//   - now() <= bonuses_close_at -> błąd "jeszcze zamknięte"
//     (RLS i tak by odrzuciło SELECT, ale chcemy ładny polski komunikat)
//   - now() >  bonuses_close_at -> zwracamy listę (RLS pozwala)
//
// Filtrowanie botów:
//   - bot_ukryty=true: SERVER-SIDE wycięte z listy dla zwykłych userów
//     (admin widzi wszystko, identycznie jak w pobierzCudzeTypy)
//   - is_bot=true bez bot_ukryty: zostawiamy w wyniku, ale dorzucamy
//     flagę isBot - klient ma odfiltrować po stronie przeglądarki przez
//     useUkryjAI (ten sam wzorzec co cudze typy meczowe)
//
// Zwraca surowe pola odpowiedzi (answer_text, answer_team_id, answer_boolean,
// selected_option_id, answer_other_flag, points) - formatowanie do
// czytelnego tekstu robi klient, bo i tak ma już pod ręką dane pytania,
// opcje i drużyny (z renderu listy).
const SchematCudzychOdp = z.object({
  questionId: z.coerce.number().int().positive(),
});

export async function pobierzCudzeOdpowiedziBonusowe(args) {
  const parsed = SchematCudzychOdp.safeParse(args);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { questionId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  // Defense in depth: RLS już to zablokuje, ale dla jasnego komunikatu po
  // polsku weryfikujemy bonuses_close_at po stronie serwera.
  const { data: settings, error: sE } = await supabase
    .from('tournament_settings')
    .select('bonuses_close_at')
    .eq('id', 1)
    .single();
  if (sE || !settings) return { error: 'Brak ustawień turnieju.' };
  if (new Date(settings.bonuses_close_at) > new Date()) {
    return {
      error:
        'Odpowiedzi innych zobaczysz po zamknięciu typowania bonusów.',
    };
  }

  // Sprawdź, że pytanie istnieje (i przy okazji weź is_settled - klient pokaże
  // punkty tylko gdy pytanie rozliczone).
  const { data: pytanie, error: pytE } = await supabase
    .from('bonus_questions')
    .select('id, is_settled')
    .eq('id', questionId)
    .single();
  if (pytE || !pytanie) return { error: 'Pytanie nie istnieje.' };

  // Dwa osobne zapytania zamiast JOIN-a: bonus_answers.user_id i profiles.id
  // oba wskazują na auth.users.id, ale Supabase nie zna tej relacji
  // (brak FK bonus_answers -> profiles), więc embed by sypał błędem
  // "Could not find a relationship". Mergujemy po stronie JS - ten sam
  // wzorzec co w pobierzCudzeTypy.
  const { data: odpowiedzi, error: odpE } = await supabase
    .from('bonus_answers')
    .select(
      'user_id, answer_text, answer_team_id, answer_boolean, selected_option_id, answer_other_flag, points',
    )
    .eq('question_id', questionId);
  if (odpE) return { error: odpE.message };
  if (!odpowiedzi || odpowiedzi.length === 0) {
    return { ok: true, isSettled: pytanie.is_settled, odpowiedzi: [] };
  }

  const userIds = odpowiedzi.map((o) => o.user_id);
  const { data: profiles, error: profE } = await supabase
    .from('profiles')
    .select('id, nick, is_bot, bot_ukryty')
    .in('id', userIds);
  if (profE) return { error: profE.message };

  // Admin widzi cudze odpowiedzi ukrytych botów - dla zwykłych userów
  // wypadają z listy całkowicie.
  const { data: jaProfil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  const jestAdmin = !!jaProfil?.is_admin;

  const profilMap = new Map();
  for (const p of profiles || []) {
    profilMap.set(p.id, p);
  }

  // Sort: malejąco po points (NULL na koniec - jeszcze nierozliczone),
  // potem alfabetycznie po nicku. Własną odpowiedź usera filtrujemy -
  // na liście pytań widzi ją osobno ("Twoja odpowiedź"), duplikat tylko
  // by zaśmiecał (tak samo jak przy cudzych typach meczowych).
  const lista = odpowiedzi
    .filter((o) => o.user_id !== user.id)
    .filter((o) => {
      if (jestAdmin) return true;
      const prof = profilMap.get(o.user_id);
      return !prof?.bot_ukryty;
    })
    .map((o) => {
      const prof = profilMap.get(o.user_id);
      return {
        userId: o.user_id,
        nick: prof?.nick || 'Anonim',
        isBot: !!prof?.is_bot,
        botUkryty: !!prof?.bot_ukryty,
        answerText: o.answer_text ?? null,
        answerTeamId: o.answer_team_id ?? null,
        answerBoolean: o.answer_boolean ?? null,
        selectedOptionId: o.selected_option_id ?? null,
        answerOtherFlag: !!o.answer_other_flag,
        points: o.points ?? null,
      };
    })
    .sort((a, b) => {
      const ap = a.points ?? -1;
      const bp = b.points ?? -1;
      if (ap !== bp) return bp - ap;
      return a.nick.localeCompare(b.nick, 'pl');
    });

  return { ok: true, isSettled: pytanie.is_settled, odpowiedzi: lista };
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

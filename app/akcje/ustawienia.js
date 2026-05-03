'use server';

// Server Action ustawień turnieju (jednowierszowa tabela tournament_settings, id=1).
// Daty z formularza datetime-local są w czasie polskim - konwertujemy do UTC.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { strefaPolskaDoDate } from '@/lib/format';

const SchematUstawien = z.object({
  tournament_name: z
    .string()
    .trim()
    .min(2, { message: 'Nazwa turnieju musi mieć min. 2 znaki.' })
    .max(100, { message: 'Nazwa max 100 znaków.' }),
  bonuses_close_at: z.string().min(1, { message: 'Podaj datę zamknięcia bonusów.' }),
  tournament_starts_at: z.string().min(1, { message: 'Podaj datę startu turnieju.' }),
});

export async function aktualizujUstawienia(_prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = SchematUstawien.safeParse({
    tournament_name: formData.get('tournament_name'),
    bonuses_close_at: formData.get('bonuses_close_at'),
    tournament_starts_at: formData.get('tournament_starts_at'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const closeAt = strefaPolskaDoDate(parsed.data.bonuses_close_at);
  const startsAt = strefaPolskaDoDate(parsed.data.tournament_starts_at);
  if (!closeAt || !startsAt) {
    return { error: 'Nieprawidłowe daty.' };
  }
  if (closeAt > startsAt) {
    return {
      error: 'Bonusy muszą się zamknąć najpóźniej w momencie startu turnieju.',
    };
  }

  const { error } = await auth.supabase
    .from('tournament_settings')
    .update({
      tournament_name: parsed.data.tournament_name,
      bonuses_close_at: closeAt.toISOString(),
      tournament_starts_at: startsAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) return { error: error.message };

  revalidatePath('/admin/ustawienia');
  revalidatePath('/admin');
  return { ok: 'Ustawienia zapisane.' };
}

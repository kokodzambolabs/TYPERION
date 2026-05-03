'use server';

// Server Actions dla zarządzania meczami (panel admina /admin/mecze).
// Edycja zablokowana po kickoff_at lub gdy status != 'scheduled'.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { polaczDateCzasPL } from '@/lib/format';

const SchematMeczu = z
  .object({
    home_team_id: z.coerce.number().int().positive({ message: 'Wybierz gospodarzy.' }),
    away_team_id: z.coerce.number().int().positive({ message: 'Wybierz gości.' }),
    kickoff_date: z.string().min(1, { message: 'Podaj datę meczu.' }),
    kickoff_time: z.string().min(1, { message: 'Podaj godzinę meczu.' }),
  })
  .refine((d) => d.home_team_id !== d.away_team_id, {
    message: 'Gospodarze i goście to muszą być różne drużyny.',
  });

function parsujFormularz(formData) {
  return SchematMeczu.safeParse({
    home_team_id: formData.get('home_team_id'),
    away_team_id: formData.get('away_team_id'),
    kickoff_date: formData.get('kickoff_date'),
    kickoff_time: formData.get('kickoff_time'),
  });
}

export async function dodajMecz(_prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = parsujFormularz(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const kickoff = polaczDateCzasPL(parsed.data.kickoff_date, parsed.data.kickoff_time);
  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    return { error: 'Nieprawidłowa data lub godzina.' };
  }

  const { error } = await auth.supabase.from('matches').insert({
    home_team_id: parsed.data.home_team_id,
    away_team_id: parsed.data.away_team_id,
    kickoff_at: kickoff.toISOString(),
    status: 'scheduled',
  });
  if (error) {
    if (error.code === '23514') {
      return { error: 'Drużyna nie może grać sama ze sobą.' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin/mecze');
  revalidatePath('/admin');
  redirect('/admin/mecze');
}

export async function edytujMecz(id, _prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const meczId = Number(id);
  if (!meczId) return { error: 'Nieprawidłowy identyfikator meczu.' };

  // Pobierz aktualny mecz - sprawdzamy czy edycja jeszcze możliwa.
  const { data: aktualny } = await auth.supabase
    .from('matches')
    .select('id, kickoff_at, status')
    .eq('id', meczId)
    .single();
  if (!aktualny) return { error: 'Mecz nie istnieje.' };
  if (aktualny.status !== 'scheduled' || new Date(aktualny.kickoff_at) <= new Date()) {
    return { error: 'Mecz już się rozpoczął - edycja zablokowana.' };
  }

  const parsed = parsujFormularz(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const kickoff = polaczDateCzasPL(parsed.data.kickoff_date, parsed.data.kickoff_time);
  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    return { error: 'Nieprawidłowa data lub godzina.' };
  }

  const { error } = await auth.supabase
    .from('matches')
    .update({
      home_team_id: parsed.data.home_team_id,
      away_team_id: parsed.data.away_team_id,
      kickoff_at: kickoff.toISOString(),
    })
    .eq('id', meczId);
  if (error) {
    if (error.code === '23514') {
      return { error: 'Drużyna nie może grać sama ze sobą.' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin/mecze');
  revalidatePath(`/admin/mecze/${meczId}/edycja`);
  redirect('/admin/mecze');
}

export async function usunMecz(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const meczId = Number(id);
  if (!meczId) return { error: 'Nieprawidłowy identyfikator meczu.' };

  // predictions kasują się kaskadowo (FK ON DELETE CASCADE w schemacie).
  const { error } = await auth.supabase.from('matches').delete().eq('id', meczId);
  if (error) return { error: error.message };

  revalidatePath('/admin/mecze');
  revalidatePath('/admin');
  return { ok: true };
}

'use server';

// Server Actions dla zarządzania kodami zaproszeń.
// Wszystkie funkcje wymagają is_admin = true (sprawdzAdmina + RLS).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { generujKod } from '@/lib/invitations';

const SchematNowegoKodu = z.object({
  description: z
    .string()
    .trim()
    .min(1, { message: 'Podaj opis kodu (np. "dla Adama").' })
    .max(100, { message: 'Opis może mieć maksymalnie 100 znaków.' }),
  maxUses: z.coerce
    .number()
    .int()
    .min(1, { message: 'Liczba użyć musi być >= 1.' })
    .max(1000, { message: 'Liczba użyć nie może przekraczać 1000.' }),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || !Number.isNaN(Date.parse(v)),
      { message: 'Nieprawidłowa data wygaśnięcia.' },
    ),
});

export async function wygenerujKod(_prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return { error: auth.error };

  const parsed = SchematNowegoKodu.safeParse({
    description: formData.get('description') ?? '',
    maxUses: formData.get('maxUses') ?? 1,
    expiresAt: formData.get('expiresAt') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Pętla na wypadek kolizji UNIQUE - przy 31^8 kombinacjach to ekstremalnie
  // mało prawdopodobne, ale tania ochrona.
  let kod = null;
  for (let proba = 0; proba < 5; proba++) {
    const kandydat = generujKod();
    const { data, error } = await auth.supabase
      .from('invitation_codes')
      .insert({
        code: kandydat,
        description: parsed.data.description,
        max_uses: parsed.data.maxUses,
        expires_at: parsed.data.expiresAt,
        created_by: auth.user.id,
      })
      .select('code')
      .single();
    if (!error) {
      kod = data.code;
      break;
    }
    if (error.code !== '23505') {
      return { error: error.message };
    }
  }
  if (!kod) {
    return { error: 'Nie udało się wygenerować unikalnego kodu. Spróbuj ponownie.' };
  }

  revalidatePath('/admin/zaproszenia');
  revalidatePath('/admin');
  redirect(`/admin/zaproszenia?nowy=${encodeURIComponent(kod)}`);
}

export async function dezaktywujKod(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return { error: auth.error };

  const kodId = Number(id);
  if (!kodId) return { error: 'Nieprawidłowy identyfikator kodu.' };

  const { error } = await auth.supabase
    .from('invitation_codes')
    .update({ is_active: false })
    .eq('id', kodId);
  if (error) return { error: error.message };

  revalidatePath('/admin/zaproszenia');
  return { ok: true };
}

export async function aktywujKod(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return { error: auth.error };

  const kodId = Number(id);
  if (!kodId) return { error: 'Nieprawidłowy identyfikator kodu.' };

  const { error } = await auth.supabase
    .from('invitation_codes')
    .update({ is_active: true })
    .eq('id', kodId);
  if (error) return { error: error.message };

  revalidatePath('/admin/zaproszenia');
  return { ok: true };
}

export async function usunKod(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return { error: auth.error };

  const kodId = Number(id);
  if (!kodId) return { error: 'Nieprawidłowy identyfikator kodu.' };

  // Nie pozwalamy usunąć kodu, który był już użyty - zostawia ślad
  // w invitation_code_uses i nie chcemy go zerwać. Admin może
  // dezaktywować taki kod zamiast usuwać.
  const { data: kod, error: fetchErr } = await auth.supabase
    .from('invitation_codes')
    .select('uses_count')
    .eq('id', kodId)
    .single();
  if (fetchErr) return { error: fetchErr.message };
  if (kod && kod.uses_count > 0) {
    return {
      error: 'Nie można usunąć kodu, który był już użyty. Dezaktywuj go zamiast usuwać.',
    };
  }

  const { error } = await auth.supabase
    .from('invitation_codes')
    .delete()
    .eq('id', kodId);
  if (error) return { error: error.message };

  revalidatePath('/admin/zaproszenia');
  revalidatePath('/admin');
  return { ok: true };
}

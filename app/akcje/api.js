'use server';

// Server Actions Fazy 7 - integracja z Football-Data.org.
//
// 1) zapiszMapowaniaZespolow(mappings) - bulk update teams.external_id.
// 2) zapiszMapowaniaMeczow(mappings)  - bulk update matches.external_id.
// 3) recznieAktualizujWyniki()        - admin klika "Odśwież teraz".
//    Wywołuje wspólny rdzeń aktualizujWynikiCore z lib/aktualizator -
//    tej samej funkcji używa cron (z klientem service_role).

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { aktualizujWynikiCore } from '@/lib/aktualizator';

// ---------------------------------------------------------------------
// Schemat wspólny dla obu mapowań - { id, externalId | null }.
// externalId może przyjść jako liczba, '' (czyść), null lub string z liczbą.
// ---------------------------------------------------------------------
const elementMapowania = (klucz) =>
  z.object({
    [klucz]: z.coerce.number().int().positive(),
    externalId: z
      .union([z.coerce.number().int().positive(), z.literal(''), z.null()])
      .nullable()
      .transform((v) => (v === '' || v == null ? null : Number(v))),
  });

const SchematMapowaniaDruzyn = z.array(elementMapowania('teamId'));
const SchematMapowaniaMeczow = z.array(elementMapowania('matchId'));

// ---------------------------------------------------------------------
// 1. Mapowanie drużyn -> teams.external_id
// ---------------------------------------------------------------------
export async function zapiszMapowaniaZespolow(mappings) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = SchematMapowaniaDruzyn.safeParse(mappings);
  if (!parsed.success) return { error: 'Nieprawidłowe mapowania drużyn.' };

  // UPDATE pojedynczo - Supabase nie ma "bulk update z różnymi wartościami
  // per wiersz" bez upsert-a. Przy ~32 drużynach na turniej to nieistotne.
  const updates = parsed.data.map(({ teamId, externalId }) =>
    auth.supabase.from('teams').update({ external_id: externalId }).eq('id', teamId),
  );
  const wyniki = await Promise.all(updates);
  const blad = wyniki.find((r) => r.error);
  if (blad?.error) return { error: blad.error.message };

  revalidatePath('/admin/druzyny');
  revalidatePath('/admin/druzyny/mapowanie');
  revalidatePath('/admin/druzyny/automapowanie');
  return { ok: `Zapisano mapowania drużyn (${parsed.data.length}).` };
}

// ---------------------------------------------------------------------
// 2. Mapowanie meczów -> matches.external_id
// ---------------------------------------------------------------------
export async function zapiszMapowaniaMeczow(mappings) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = SchematMapowaniaMeczow.safeParse(mappings);
  if (!parsed.success) return { error: 'Nieprawidłowe mapowania meczów.' };

  const updates = parsed.data.map(({ matchId, externalId }) =>
    auth.supabase.from('matches').update({ external_id: externalId }).eq('id', matchId),
  );
  const wyniki = await Promise.all(updates);
  const blad = wyniki.find((r) => r.error);
  if (blad?.error) return { error: blad.error.message };

  revalidatePath('/admin/mecze');
  revalidatePath('/admin/mecze/mapowanie');
  return { ok: `Zapisano mapowania meczów (${parsed.data.length}).` };
}

// ---------------------------------------------------------------------
// 3. Ręczna aktualizacja wyników - guzik "Odśwież teraz" w /admin/mecze
// ---------------------------------------------------------------------
export async function recznieAktualizujWyniki() {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  // Klient z sesją admina - RLS przepuści UPDATE matches/predictions,
  // bo admin ma osobne polityki (matches_update_admin, predictions_admin_update).
  return aktualizujWynikiCore(auth.supabase);
}

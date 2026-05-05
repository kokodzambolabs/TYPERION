'use server';

// Server Actions dla zarządzania drużynami (panel admina /admin/druzyny).
// Walidacja przez zod, sprawdzenie is_admin defense-in-depth.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { TLUMACZENIA_PL_EN } from '@/lib/translateTeams';

const SchematDruzyny = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Nazwa musi mieć minimum 2 znaki.' })
    .max(50, { message: 'Nazwa może mieć maksymalnie 50 znaków.' }),
});

function parsujFormularz(formData) {
  return SchematDruzyny.safeParse({
    name: formData.get('name') ?? '',
  });
}

export async function dodajDruzyne(_prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const parsed = parsujFormularz(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await auth.supabase.from('teams').insert(parsed.data);
  if (error) {
    if (error.code === '23505') {
      return { error: 'Drużyna o tej nazwie już istnieje.' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin/druzyny');
  revalidatePath('/admin');
  redirect('/admin/druzyny');
}

export async function edytujDruzyne(id, _prev, formData) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const druzynaId = Number(id);
  if (!druzynaId) return { error: 'Nieprawidłowy identyfikator drużyny.' };

  const parsed = parsujFormularz(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await auth.supabase
    .from('teams')
    .update(parsed.data)
    .eq('id', druzynaId);
  if (error) {
    if (error.code === '23505') {
      return { error: 'Drużyna o tej nazwie już istnieje.' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin/druzyny');
  revalidatePath(`/admin/druzyny/${druzynaId}/edycja`);
  redirect('/admin/druzyny');
}

export async function usunDruzyne(id) {
  const auth = await sprawdzAdmina();
  if (auth.error) return auth;

  const druzynaId = Number(id);
  if (!druzynaId) return { error: 'Nieprawidłowy identyfikator drużyny.' };

  // Nie pozwalamy usunąć drużyny używanej w meczach.
  const { count: liczbaMeczow } = await auth.supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`home_team_id.eq.${druzynaId},away_team_id.eq.${druzynaId}`);
  if ((liczbaMeczow ?? 0) > 0) {
    const slowo = liczbaMeczow === 1 ? 'meczu' : 'meczach';
    return { error: `Nie można usunąć - drużyna jest używana w ${liczbaMeczow} ${slowo}.` };
  }

  // Ani jako correct_team_id w pytaniach bonusowych.
  const { count: liczbaPytan } = await auth.supabase
    .from('bonus_questions')
    .select('id', { count: 'exact', head: true })
    .eq('correct_team_id', druzynaId);
  if ((liczbaPytan ?? 0) > 0) {
    const slowo = liczbaPytan === 1 ? 'pytaniu' : 'pytaniach';
    return { error: `Nie można usunąć - drużyna jest poprawną odpowiedzią w ${liczbaPytan} ${slowo} bonusowych.` };
  }

  // Ani jako answer_team_id w odpowiedziach userów.
  const { count: liczbaOdp } = await auth.supabase
    .from('bonus_answers')
    .select('id', { count: 'exact', head: true })
    .eq('answer_team_id', druzynaId);
  if ((liczbaOdp ?? 0) > 0) {
    const slowo = liczbaOdp === 1 ? 'odpowiedzi' : 'odpowiedziach';
    return { error: `Nie można usunąć - drużyna jest wybrana w ${liczbaOdp} ${slowo} userów.` };
  }

  const { error } = await auth.supabase.from('teams').delete().eq('id', druzynaId);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Drużyna jest używana w innych tabelach - nie można jej usunąć.' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin/druzyny');
  revalidatePath('/admin');
  return { ok: true };
}

// ---------------------------------------------------------------------
// Bulk tłumaczenie nazw drużyn (reprezentacje narodowe).
// Wejście: [{ teamId, newName }] - lista mapowań do zastosowania.
//
// Dla każdego mapowania:
//   - jeśli jakaś INNA drużyna ma już nazwę newName i ma external_id:
//       konflikt - zostawiamy obie (admin musi to rozwiązać ręcznie),
//   - jeśli ma nazwę newName ale BEZ external_id (pusty placeholder
//       admina): merguj - usuń placeholder, zmień nazwę starej drużyny,
//   - jeśli nie ma duplikatu: zwykły UPDATE name.
//
// Zwraca: { success, translated, skipped, errors }.
// ---------------------------------------------------------------------
const SchematTlumaczen = z
  .array(
    z.object({
      teamId: z.coerce.number().int().positive(),
      newName: z
        .string()
        .trim()
        .min(2, { message: 'Nazwa musi mieć minimum 2 znaki.' })
        .max(50, { message: 'Nazwa może mieć maksymalnie 50 znaków.' }),
    }),
  )
  .min(1, { message: 'Brak tłumaczeń do zastosowania.' });

export async function zastosujTlumaczenia(translations) {
  const auth = await sprawdzAdmina();
  if (auth.error) return { success: false, error: auth.error };

  const parsed = SchematTlumaczen.safeParse(translations);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Defense-in-depth: każdy newName musi być KLUCZEM polskim ze słownika -
  // odrzucamy próby wstrzyknięcia dowolnej nazwy przez zmanipulowanego klienta.
  for (const { newName } of parsed.data) {
    if (!Object.prototype.hasOwnProperty.call(TLUMACZENIA_PL_EN, newName)) {
      return {
        success: false,
        error: `Nazwa "${newName}" nie jest w słowniku tłumaczeń.`,
      };
    }
  }

  // Pełna lista drużyn - przy ~32 drużynach na turniej można sobie pozwolić.
  const { data: wszystkieDruzyny, error: fetchE } = await auth.supabase
    .from('teams')
    .select('id, name, external_id');
  if (fetchE) {
    return { success: false, error: `Nie udało się pobrać drużyn: ${fetchE.message}` };
  }

  const poId = new Map();
  const poNazwie = new Map();
  for (const t of wszystkieDruzyny || []) {
    poId.set(t.id, t);
    poNazwie.set(t.name, t);
  }

  let translated = 0;
  let skipped = 0;
  const errors = [];

  for (const { teamId, newName } of parsed.data) {
    const team = poId.get(teamId);
    if (!team) {
      errors.push(`Drużyna o ID ${teamId} nie istnieje.`);
      skipped++;
      continue;
    }
    if (team.name === newName) {
      // Nic do roboty - już ma docelową nazwę.
      skipped++;
      continue;
    }

    const dup = poNazwie.get(newName);
    if (dup && dup.id !== teamId) {
      if (dup.external_id != null) {
        errors.push(
          `"${team.name}" → "${newName}": drużyna "${newName}" jest już zmapowana do API. Pominięto.`,
        );
        skipped++;
        continue;
      }

      // Merge: pusty placeholder polski - usuwamy go, zwalniamy nazwę.
      const { error: delE } = await auth.supabase
        .from('teams')
        .delete()
        .eq('id', dup.id);
      if (delE) {
        const opis =
          delE.code === '23503'
            ? `duplikat "${newName}" jest używany w innych tabelach (mecze/bonusy)`
            : delE.message;
        errors.push(`"${team.name}" → "${newName}": ${opis}.`);
        skipped++;
        continue;
      }
      poNazwie.delete(newName);
      poId.delete(dup.id);
    }

    const { error: updE } = await auth.supabase
      .from('teams')
      .update({ name: newName })
      .eq('id', teamId);
    if (updE) {
      errors.push(`"${team.name}" → "${newName}": ${updE.message}`);
      skipped++;
      continue;
    }

    poNazwie.delete(team.name);
    const updated = { ...team, name: newName };
    poNazwie.set(newName, updated);
    poId.set(teamId, updated);
    translated++;
  }

  if (translated > 0) {
    revalidatePath('/admin/druzyny');
    revalidatePath('/admin/druzyny/tlumacz');
    revalidatePath('/admin/druzyny/mapowanie');
    revalidatePath('/admin/druzyny/automapowanie');
    revalidatePath('/admin/mecze');
    revalidatePath('/admin/bonusy');
    revalidatePath('/admin');
    revalidatePath('/mecze');
    revalidatePath('/ranking');
    revalidatePath('/');
  }

  return { success: true, translated, skipped, errors };
}

// ---------------------------------------------------------------------
// Przypisanie drużyn do grup turniejowych (MŚ).
// Czyta matches.group_name dla competition_code='WC' i ustawia
// teams.group_in_tournament dla każdej drużyny występującej w meczu
// fazy grupowej (group_name LIKE 'GROUP_%'). Drużyny które grały w
// kilku grupach (nie powinno się zdarzyć) dostają grupę z ostatniego
// przetworzonego meczu - ale w MŚ to niemożliwe.
//
// Zwraca: { success, updated } - liczba drużyn którym faktycznie
// zmieniliśmy/ustawiliśmy group_in_tournament.
// ---------------------------------------------------------------------
export async function aktualizujGrupyDruzyn() {
  const auth = await sprawdzAdmina();
  if (auth.error) return { success: false, error: auth.error };

  const { data: mecze, error: meczeE } = await auth.supabase
    .from('matches')
    .select('home_team_id, away_team_id, group_name')
    .eq('competition_code', 'WC')
    .like('group_name', 'GROUP_%');
  if (meczeE) {
    return { success: false, error: `Nie udało się pobrać meczów: ${meczeE.message}` };
  }

  // teamId -> group_name. Każdy mecz dorzuca obie drużyny.
  const grupaPoTeamId = new Map();
  for (const m of mecze || []) {
    if (!m.group_name) continue;
    if (m.home_team_id) grupaPoTeamId.set(m.home_team_id, m.group_name);
    if (m.away_team_id) grupaPoTeamId.set(m.away_team_id, m.group_name);
  }

  if (grupaPoTeamId.size === 0) {
    return { success: true, updated: 0 };
  }

  // Aktualne wartości - pomijamy drużyny które już mają poprawnie ustawioną grupę.
  const teamIds = Array.from(grupaPoTeamId.keys());
  const { data: aktualne, error: aktE } = await auth.supabase
    .from('teams')
    .select('id, group_in_tournament')
    .in('id', teamIds);
  if (aktE) {
    return { success: false, error: `Nie udało się pobrać drużyn: ${aktE.message}` };
  }

  const aktualnaGrupa = new Map();
  for (const t of aktualne || []) aktualnaGrupa.set(t.id, t.group_in_tournament);

  let updated = 0;
  for (const [teamId, groupName] of grupaPoTeamId) {
    if (aktualnaGrupa.get(teamId) === groupName) continue;
    const { error: updE } = await auth.supabase
      .from('teams')
      .update({ group_in_tournament: groupName })
      .eq('id', teamId);
    if (updE) {
      return { success: false, error: `Drużyna #${teamId}: ${updE.message}` };
    }
    updated++;
  }

  if (updated > 0) {
    revalidatePath('/admin/druzyny');
    revalidatePath('/admin/bonusy');
    revalidatePath('/bonusy');
  }

  return { success: true, updated };
}

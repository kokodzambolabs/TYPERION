'use server';

// Import meczów z Football-Data.org do tabeli matches.
// Wywoływane z /admin/import po kliknięciu przez admina.
//
// Logika:
//   1) Pobierz listę meczów z API (pobierzMecze - lib/footballData).
//   2) Pobierz nasze teams z external_id != null - zbuduj mapę
//      external_id (API) -> nasz team.id.
//   3) Pobierz wszystkie matches.external_id z bazy do Set-a -
//      sprawdzanie istnienia bez N osobnych zapytań.
//   4) Dla każdego meczu z API:
//        - jeśli istnieje w bazie po external_id → skipped++
//        - jeśli któraś drużyna nieZmapowana → skippedNoMapping++
//        - inaczej INSERT (status='scheduled', kickoff_at = utcDate).
//   5) revalidatePath('/admin/mecze') i '/admin/import'.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sprawdzAdmina } from '@/lib/admin';
import { pobierzMecze, pobierzZespoly } from '@/lib/footballData';
import { DOZWOLONE_COMPETITIONS } from '@/lib/competitions';

const SchematCompetition = z
  .string()
  .refine((v) => DOZWOLONE_COMPETITIONS.includes(v), {
    message: 'Niedozwolony kod rozgrywek.',
  });

// Football-Data zwraca etapy pucharowe długimi nazwami (LAST_16, ...),
// a my w bazie trzymamy krótkie kody (R16, ...) - czyPucharowy() i kod
// rankingu/statystyk zakładają krótki wariant. Normalizujemy LONG → SHORT
// przy zapisie, żeby nowe mecze nie psuły spójności.
// Idempotentne: krótki kod mapuje się na samego siebie, GROUP_* zostaje.
const MAPOWANIE_ETAPOW_IMPORT = {
  LAST_32: 'R32',
  LAST_16: 'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS: 'SF',
  THIRD_PLACE_FINAL: 'THIRD_PLACE',
  FINAL: 'FINAL',
  R32: 'R32',
  R16: 'R16',
  QF: 'QF',
  SF: 'SF',
  THIRD_PLACE: 'THIRD_PLACE',
};

function normalizujEtap(stage) {
  if (!stage) return null;
  if (stage.startsWith('GROUP_')) return stage;
  return MAPOWANIE_ETAPOW_IMPORT[stage] || stage;
}

// `opcje.tylkoPrzyszle`: true (domyślnie) - z API zaciągamy tylko nieskończone
// mecze; false - importujemy też FINISHED (przydatne przy pierwszym imporcie
// historii albo gdyby admin chciał odtworzyć wyniki).
export async function importujMecze(competition = 'WC', opcje = {}) {
  const auth = await sprawdzAdmina();
  if (auth.error) return { success: false, error: auth.error };

  const parsed = SchematCompetition.safeParse(competition);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const kod = parsed.data;
  const tylkoPrzyszle = opcje?.tylkoPrzyszle !== false;

  console.log(`[import] start: competition=${kod} tylkoPrzyszle=${tylkoPrzyszle}`);

  // 1) Mecze z API
  const apiResp = await pobierzMecze(kod, { tylkoPrzyszle });
  if (!apiResp.success) {
    console.error('[import] API error:', apiResp.error);
    return {
      success: false,
      error: apiResp.error,
      imported: 0,
      skipped: 0,
      skippedNoMapping: 0,
      errors: [],
    };
  }
  const apiMecze = apiResp.data || [];
  console.log(`[import] z API: ${apiMecze.length} meczów`);

  // 2) Nasze drużyny z external_id - mapa: external_id -> { id, name }
  const { data: druzyny, error: druzynyE } = await auth.supabase
    .from('teams')
    .select('id, name, external_id')
    .not('external_id', 'is', null);
  if (druzynyE) {
    console.error('[import] błąd pobrania drużyn:', druzynyE.message);
    return {
      success: false,
      error: `Nie udało się pobrać drużyn: ${druzynyE.message}`,
      imported: 0,
      skipped: 0,
      skippedNoMapping: 0,
      errors: [],
    };
  }
  const mapaDruzyn = new Map();
  for (const d of druzyny || []) {
    mapaDruzyn.set(d.external_id, { id: d.id, name: d.name });
  }
  console.log(`[import] zmapowanych drużyn: ${mapaDruzyn.size}`);

  // 3) Istniejące mecze po external_id - mapa do szybkiego "exists?" + lookup
  // pól competition_code/group_name (są NULL dla meczów zaimportowanych
  // przed migracją MIGRACJA_COMPETITION - musimy je uzupełnić).
  const { data: istniejace, error: istniejaceE } = await auth.supabase
    .from('matches')
    .select('id, external_id, competition_code, group_name')
    .not('external_id', 'is', null);
  if (istniejaceE) {
    console.error('[import] błąd pobrania matches:', istniejaceE.message);
    return {
      success: false,
      error: `Nie udało się pobrać meczów z bazy: ${istniejaceE.message}`,
      imported: 0,
      skipped: 0,
      skippedNoMapping: 0,
      errors: [],
    };
  }
  const istniejaceMap = new Map();
  for (const m of istniejace || []) {
    istniejaceMap.set(m.external_id, m);
  }

  // 4) Pętla po meczach z API
  let imported = 0;
  let skipped = 0;
  let updatedMeta = 0; // istniejący mecz - uzupełniliśmy competition_code/group_name
  let skippedNoMapping = 0;
  const errors = [];
  const niezmapowane = []; // { name, externalId } - do logu/diagnostyki

  for (const apiMecz of apiMecze) {
    const apiId = apiMecz?.id;
    if (apiId == null) {
      errors.push('Mecz z API bez id - pominięty.');
      continue;
    }

    // group_name: dla fazy grupowej API zwraca apiMecz.group ('GROUP_A',
    // 'GROUP_B', ...), a dla pucharów apiMecz.stage ('ROUND_OF_16',
    // 'QUARTER_FINAL', ...). Trzymamy obie wartości w jednej kolumnie -
    // formatGrupa() w lib/format.js umie ładnie wyświetlić oba warianty.
    // Dla ligowych meczów zostawiamy null.
    const groupName = normalizujEtap(
      apiMecz.group ||
        (apiMecz.stage && apiMecz.stage !== 'REGULAR_SEASON'
          ? apiMecz.stage
          : null),
    );

    // Już w bazie? Backfillujemy competition_code/group_name jeśli NULL.
    // Wartości już ustawionych NIE NADPISUJEMY - może admin coś poprawił
    // ręcznie i nie chcemy mu tego skasować.
    const istniejacy = istniejaceMap.get(apiId);
    if (istniejacy) {
      const patch = {};
      if (istniejacy.competition_code == null) patch.competition_code = kod;
      if (istniejacy.group_name == null && groupName) patch.group_name = groupName;
      if (Object.keys(patch).length > 0) {
        const { error: updE } = await auth.supabase
          .from('matches')
          .update(patch)
          .eq('id', istniejacy.id);
        if (updE) {
          console.error(
            `[import] UPDATE mecz API id=${apiId}:`,
            updE.message,
          );
          errors.push(`Backfill API id=${apiId}: ${updE.message}`);
        } else {
          updatedMeta++;
        }
      } else {
        skipped++;
      }
      continue;
    }

    const homeApi = apiMecz.homeTeam || {};
    const awayApi = apiMecz.awayTeam || {};
    const home = mapaDruzyn.get(homeApi.id);
    const away = mapaDruzyn.get(awayApi.id);

    if (!home || !away) {
      if (!home) niezmapowane.push({ name: homeApi.name || '?', externalId: homeApi.id });
      if (!away) niezmapowane.push({ name: awayApi.name || '?', externalId: awayApi.id });
      console.warn(
        `[import] pomijam mecz API id=${apiId}: drużyna niezmapowana ` +
          `(home=${homeApi.name}/${homeApi.id} → ${home ? 'OK' : 'BRAK'}, ` +
          `away=${awayApi.name}/${awayApi.id} → ${away ? 'OK' : 'BRAK'})`,
      );
      skippedNoMapping++;
      continue;
    }

    if (!apiMecz.utcDate) {
      errors.push(`Mecz API id=${apiId}: brak utcDate, pominięty.`);
      continue;
    }

    const { error: insertE } = await auth.supabase.from('matches').insert({
      home_team_id: home.id,
      away_team_id: away.id,
      kickoff_at: apiMecz.utcDate, // timestamptz - baza weźmie UTC i poprawnie zinterpretuje
      external_id: apiId,
      competition_code: kod,
      group_name: groupName,
      status: 'scheduled',
    });

    if (insertE) {
      console.error(
        `[import] INSERT mecz API id=${apiId} (${home.name} vs ${away.name}):`,
        insertE.message,
      );
      errors.push(
        `${home.name} vs ${away.name} (API id=${apiId}): ${insertE.message}`,
      );
      continue;
    }

    imported++;
  }

  // Deduplikuj i posortuj brakujące drużyny - wygodniej diagnozować w logach.
  const niezmapowaneDedupe = Array.from(
    new Map(niezmapowane.map((n) => [n.externalId, n])).values(),
  );

  console.log(
    `[import] wynik: imported=${imported} updatedMeta=${updatedMeta} ` +
      `skipped=${skipped} skippedNoMapping=${skippedNoMapping} ` +
      `errors=${errors.length} niezmapowanych drużyn unikalnych=${niezmapowaneDedupe.length}`,
  );

  if (imported > 0 || updatedMeta > 0) {
    revalidatePath('/admin/mecze');
    revalidatePath('/admin');
    revalidatePath('/admin/import');
    revalidatePath('/mecze');
  }

  return {
    success: true,
    imported,
    updatedMeta,
    skipped,
    skippedNoMapping,
    errors,
    niezmapowaneDruzyny: niezmapowaneDedupe,
  };
}

// Import drużyn dla wybranej competycji z Football-Data.org. Pobiera listę
// zespołów z /v4/competitions/{code}/teams i wkłada do tabeli `teams`
// te, których jeszcze nie ma (po external_id). Drużyny istniejące już
// w bazie (po nazwie) bez external_id - aktualizuje (uzupełnia external_id).
//
// Zwraca: { success, imported, updated, skipped, errors }.
export async function importujDruzyny(competition = 'WC') {
  const auth = await sprawdzAdmina();
  if (auth.error) return { success: false, error: auth.error };

  const parsed = SchematCompetition.safeParse(competition);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const kod = parsed.data;

  console.log(`[import-druzyny] start: competition=${kod}`);

  const apiResp = await pobierzZespoly(kod);
  if (!apiResp.success) {
    console.error('[import-druzyny] API error:', apiResp.error);
    return {
      success: false,
      error: apiResp.error,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
  }
  const apiDruzyny = apiResp.data || [];
  console.log(`[import-druzyny] z API: ${apiDruzyny.length} drużyn`);

  // Mapy z bazy - po external_id i po znormalizowanej nazwie. Dzięki
  // mapie po nazwie potrafimy "dopiąć" external_id do drużyny, którą
  // admin założył ręcznie (np. "Polska") jeszcze przed importem.
  const { data: istniejace, error: bladDb } = await auth.supabase
    .from('teams')
    .select('id, name, external_id');
  if (bladDb) {
    return {
      success: false,
      error: `Nie udało się pobrać drużyn z bazy: ${bladDb.message}`,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
  }
  const mapaPoExt = new Map();
  const mapaPoNazwie = new Map();
  for (const d of istniejace || []) {
    if (d.external_id != null) mapaPoExt.set(d.external_id, d);
    mapaPoNazwie.set(normalizujNazwe(d.name), d);
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const apiD of apiDruzyny) {
    const apiId = apiD?.id;
    const nazwa = (apiD?.name || '').trim();
    if (apiId == null || !nazwa) {
      errors.push(`Drużyna z API bez id lub nazwy - pominięta.`);
      continue;
    }

    if (mapaPoExt.has(apiId)) {
      skipped++;
      continue;
    }

    const istniejacaPoNazwie = mapaPoNazwie.get(normalizujNazwe(nazwa));
    if (istniejacaPoNazwie) {
      const { error: updE } = await auth.supabase
        .from('teams')
        .update({ external_id: apiId })
        .eq('id', istniejacaPoNazwie.id);
      if (updE) {
        errors.push(`${nazwa}: ${updE.message}`);
        continue;
      }
      mapaPoExt.set(apiId, { ...istniejacaPoNazwie, external_id: apiId });
      updated++;
      continue;
    }

    const { error: insertE } = await auth.supabase
      .from('teams')
      .insert({ name: nazwa, external_id: apiId });
    if (insertE) {
      if (insertE.code === '23505') {
        errors.push(`${nazwa}: drużyna o tej nazwie już istnieje.`);
      } else {
        errors.push(`${nazwa}: ${insertE.message}`);
      }
      continue;
    }
    imported++;
  }

  console.log(
    `[import-druzyny] wynik: imported=${imported} updated=${updated} ` +
      `skipped=${skipped} errors=${errors.length}`,
  );

  if (imported > 0 || updated > 0) {
    revalidatePath('/admin/druzyny');
    revalidatePath('/admin');
    revalidatePath('/admin/import');
  }

  return { success: true, imported, updated, skipped, errors };
}

function normalizujNazwe(s) {
  return (s || '').trim().toLowerCase();
}

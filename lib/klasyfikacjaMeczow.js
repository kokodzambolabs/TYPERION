// Wspólna klasyfikacja meczów na 5 sekcji: trwające / dzisiaj / jutro /
// nadchodzące / zakończone. Używane na /mecze (user) i /admin/mecze (admin),
// żeby logika "co jest gdzie" siedziała w jednym miejscu.
//
// Mecz piłkarski trwa max ~2h + dogrywka + karne ≈ 2.5h. Dajemy zapas do 3h
// jako granicę "po której mecz na pewno się skończył", nawet jeśli API
// (lub admin) jeszcze nie wpisali wyniku. To rozwiązuje problem starych
// meczów wiszących w "trwających" przez wiele miesięcy.

import { dateDoYmdPL } from '@/lib/format';

export const TRWANIE_MECZU_GODZINY = 3;
const MS_GODZINA = 60 * 60 * 1000;

// "YYYY-MM-DD" + 1 dzień -> "YYYY-MM-DD". Czysta arytmetyka kalendarzowa,
// niezależna od TZ - wejście i wyjście są w tej samej strefie.
function nastepnyDzienYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Zwraca jeden z 5 stringów: 'trwajace' | 'dzisiaj' | 'jutro' | 'nadchodzace' | 'zakonczone'.
// `now` to ms (Date.now()), `dzisiajPL` i `jutroPL` to YYYY-MM-DD w strefie PL.
// Trzymanie tych wartości jako argumentów zostawia funkcję czystą - łatwo
// testować i nie ma niespójności gdy klasyfikujemy listę o jednym kroku w czasie.
export function kategoriaMeczu(mecz, now, dzisiajPL, jutroPL) {
  const kickoffMs = new Date(mecz.kickoff_at).getTime();
  const koniecMs = kickoffMs + TRWANIE_MECZU_GODZINY * MS_GODZINA;

  // 1) status='live' z API to twarde info ("teraz piłka się toczy") - zawsze
  //    wpada do trwających, nawet jeśli już mamy aktualny wynik z API.
  if (mecz.status === 'live') return 'trwajace';

  // 2) status='finished' albo wpisany wynik => zakończony.
  if (mecz.status === 'finished' || mecz.home_score != null) return 'zakonczone';

  // 3) Sierota: kickoff > 3h temu, brak wyniku, status nie został podbity.
  //    Traktujemy jak zakończony - "stary mecz, nie wiadomo co".
  if (kickoffMs <= now - TRWANIE_MECZU_GODZINY * MS_GODZINA) return 'zakonczone';

  // 4) Trwa: kickoff w oknie [now-3h, now] (status nie zdążył się odświeżyć).
  if (kickoffMs <= now && now <= koniecMs) return 'trwajace';

  // 5) Po tej linii kickoff > now - mecz w przyszłości. Status powinien być
  //    'scheduled', ale jeśli nie, wpada do 'nadchodzące' tak czy siak.
  const ymd = dateDoYmdPL(mecz.kickoff_at);
  if (ymd === dzisiajPL) return 'dzisiaj';
  if (ymd === jutroPL) return 'jutro';
  return 'nadchodzace';
}

// Wygodne opakowanie: rozdziela listę na 5 sekcji gotowe do renderu.
// Kolejność: trwające/dzisiaj/jutro/nadchodzące rosnąco po kickoff_at,
// zakończone malejąco (najnowsze u góry). Zwraca też `now` (ms), żeby komponent
// renderujący nie musiał ponownie wywoływać Date.now() (purity).
export function klasyfikujMecze(lista, now = Date.now()) {
  const dzisiajPL = dateDoYmdPL(new Date(now));
  const jutroPL = nastepnyDzienYmd(dzisiajPL);
  const grupy = {
    trwajace: [],
    dzisiaj: [],
    jutro: [],
    nadchodzace: [],
    zakonczone: [],
    now,
  };
  for (const m of lista || []) {
    grupy[kategoriaMeczu(m, now, dzisiajPL, jutroPL)].push(m);
  }
  const rosnaco = (a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at);
  const malejaco = (a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at);
  grupy.trwajace.sort(rosnaco);
  grupy.dzisiaj.sort(rosnaco);
  grupy.jutro.sort(rosnaco);
  grupy.nadchodzace.sort(rosnaco);
  grupy.zakonczone.sort(malejaco);
  return grupy;
}

// Czy mecz to "sierota": był (kickoff_at + 3h < now) ale brakuje wyniku.
// Karta pokazuje wtedy "⚠️ Wynik niedostępny" zamiast home:away.
export function jestSierota(mecz, now = Date.now()) {
  if (mecz.home_score != null) return false;
  const kickoffMs = new Date(mecz.kickoff_at).getTime();
  return kickoffMs <= now - TRWANIE_MECZU_GODZINY * MS_GODZINA;
}

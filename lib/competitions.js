// Stałe dot. rozgrywek Football-Data.org.
//
// Plik istnieje jako oddzielny moduł (a nie część app/akcje/import.js),
// ponieważ pliki z dyrektywą 'use server' mogą eksportować WYŁĄCZNIE
// async funkcje. Eksport zwykłej stałej (np. tablicy lub obiektu) z
// pliku Server Actions powoduje błąd budowania:
//   "A 'use server' file can only export async functions, found object".
//
// Trzymanie tych stałych tutaj daje też jedno źródło prawdy dla
// listy dozwolonych competycji oraz ich ładnych nazw po polsku
// (DRY) - importowane zarówno przez Server Actions jak i komponenty
// client.

export const DOZWOLONE_COMPETITIONS = ['WC', 'EC', 'CL', 'PL', 'BL1', 'PD', 'SA'];

export const NAZWY_COMPETITIONS = {
  WC: 'Mistrzostwa Świata',
  EC: 'Mistrzostwa Europy',
  CL: 'Liga Mistrzów',
  PL: 'Premier League (Anglia)',
  BL1: 'Bundesliga (Niemcy)',
  PD: 'La Liga (Hiszpania)',
  SA: 'Serie A (Włochy)',
};

// Linki do strony turnieju na Flashscore. Przy karcie meczu pokazujemy
// ikonę "F" - klik otwiera odpowiednią rozgrywkę w nowej karcie.
const FLASHSCORE_URLS = {
  WC: 'https://www.flashscore.pl/pilka-nozna/swiat/mistrzostwa-swiata/',
  EC: 'https://www.flashscore.pl/pilka-nozna/europa/mistrzostwa-europy/',
  CL: 'https://www.flashscore.pl/pilka-nozna/europa/liga-mistrzow/',
  PL: 'https://www.flashscore.pl/pilka-nozna/anglia/premier-league/',
  BL1: 'https://www.flashscore.pl/pilka-nozna/niemcy/bundesliga/',
  PD: 'https://www.flashscore.pl/pilka-nozna/hiszpania/laliga/',
  SA: 'https://www.flashscore.pl/pilka-nozna/wlochy/serie-a/',
};

// Zwraca URL do Flashscore dla danego kodu competycji albo null,
// jeśli nie mamy mapowania (wtedy ikona "F" jest niewidoczna).
export function getFlashscoreUrl(competitionCode) {
  if (!competitionCode) return null;
  return FLASHSCORE_URLS[competitionCode] || null;
}

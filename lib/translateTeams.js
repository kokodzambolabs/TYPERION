// Słownik tłumaczeń TYLKO dla reprezentacji narodowych (kraje).
// Kluby celowo zostawiamy fuzzy matchingowi - ich nazwy w bazie są już
// oryginalne (np. "Real Madrid CF") i dostają dokładny match z API
// bez potrzeby tłumaczenia.

export const TLUMACZENIA_PL_EN = {
  Argentyna: 'Argentina',
  Niemcy: 'Germany',
  Polska: 'Poland',
  Brazylia: 'Brazil',
  Hiszpania: 'Spain',
  Anglia: 'England',
  Portugalia: 'Portugal',
  Włochy: 'Italy',
  Holandia: 'Netherlands',
  Belgia: 'Belgium',
  Chorwacja: 'Croatia',
  Francja: 'France',
  Meksyk: 'Mexico',
  'Stany Zjednoczone': 'United States',
  Kanada: 'Canada',
  Japonia: 'Japan',
  'Korea Południowa': 'South Korea',
  Australia: 'Australia',
  'Arabia Saudyjska': 'Saudi Arabia',
  Iran: 'Iran',
  Maroko: 'Morocco',
  Senegal: 'Senegal',
  Tunezja: 'Tunisia',
  Ghana: 'Ghana',
  Kamerun: 'Cameroon',
  Ekwador: 'Ecuador',
  Urugwaj: 'Uruguay',
  Chile: 'Chile',
  Kolumbia: 'Colombia',
  Szwajcaria: 'Switzerland',
  Dania: 'Denmark',
  Szwecja: 'Sweden',
  Norwegia: 'Norway',
  Austria: 'Austria',
  Czechy: 'Czechia',
  Słowacja: 'Slovakia',
  Serbia: 'Serbia',
  Walia: 'Wales',
  Szkocja: 'Scotland',
  Irlandia: 'Republic of Ireland',
  Turcja: 'Turkey',
  Grecja: 'Greece',
  Egipt: 'Egypt',
  Algieria: 'Algeria',
  Nigeria: 'Nigeria',
  'Nowa Zelandia': 'New Zealand',
  Curaçao: 'Curaçao',
  'Republika Zielonego Przylądka': 'Cape Verde Islands',
  'Wybrzeże Kości Słoniowej': 'Ivory Coast',
  'Demokratyczna Republika Konga': 'Congo DR',
  Paragwaj: 'Paraguay',
  'Republika Południowej Afryki': 'South Africa',
  Haiti: 'Haiti',
  Jordania: 'Jordan',
  Uzbekistan: 'Uzbekistan',
  Irak: 'Iraq',
  Katar: 'Qatar',
};

// Reverse lookup budowany raz przy imporcie modułu - klucz to lowercase
// nazwa angielska, dzięki czemu lookup jest case-insensitive.
const TLUMACZENIA_EN_PL = (() => {
  const m = {};
  for (const [pl, en] of Object.entries(TLUMACZENIA_PL_EN)) {
    m[en.toLowerCase()] = pl;
  }
  return m;
})();

export function przetlumaczNaAngielski(nazwaPL) {
  if (!nazwaPL) return null;
  return TLUMACZENIA_PL_EN[nazwaPL.trim()] ?? null;
}

export function przetlumaczNaPolski(nazwaEN) {
  if (!nazwaEN) return null;
  return TLUMACZENIA_EN_PL[nazwaEN.trim().toLowerCase()] ?? null;
}

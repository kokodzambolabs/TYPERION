// Fuzzy matching nazw drużyn dla auto-mapowania na Football-Data.org.
// Dwa eksporty:
//   - podobienstwo(a, b)        - liczba 0..1, czysta funkcja na nazwach
//   - dopasowDruzyne(nazwa, api) - 3-stopniowy pipeline: słownik → exact → fuzzy

import { przetlumaczNaAngielski } from './translateTeams';

// Słowa funkcyjne pomijane przy normalizacji - typowe sufiksy/prefiksy
// nazw klubów ("FC Porto" vs "Porto", "Real Madrid CF" vs "Real Madrid").
// Porównujemy w lowercase, więc tu też lowercase.
const SLOWA_FUNKCYJNE = new Set([
  'fc', 'afc', 'club', 'cf', 'sc', 'ac', 'ss', 'as', 'fk', 'bc', 'sk',
]);

const POLSKIE_ZNAKI = {
  ą: 'a', ę: 'e', ó: 'o', ł: 'l',
  ś: 's', ź: 'z', ż: 'z', ć: 'c', ń: 'n',
};

function normalizuj(s) {
  if (!s) return '';
  let t = String(s).toLowerCase().trim();
  t = t.replace(/[ąęółśźżćń]/g, (ch) => POLSKIE_ZNAKI[ch] || ch);
  // Usuwamy słowa funkcyjne tylko gdy stoją jako osobne tokeny - inaczej
  // "scotland" straciłby "sc" w środku.
  const tokeny = t.split(/\s+/).filter((tok) => tok && !SLOWA_FUNKCYJNE.has(tok));
  t = tokeny.join(' ').replace(/\s+/g, ' ').trim();
  return t;
}

// Klasyczny Levenshtein - dwie tablice wierszy, O(min(a,b)) pamięci.
// Drużyn na turniej max ~700 (cała europejska piłka), nazwy krótkie -
// pełna macierz NxM też by się sprawdziła, ale dwie tablice są
// idiomatyczne i czytelniejsze.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const koszt = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // usunięcie
        curr[j - 1] + 1,    // wstawienie
        prev[j - 1] + koszt // zamiana
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export function podobienstwo(a, b) {
  const na = normalizuj(a);
  const nb = normalizuj(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  let sim = 1 - dist / maxLen;

  // Bonus dla "Real" vs "Real Madrid" - krótka nazwa zawarta w pełnej.
  if (na.includes(nb) || nb.includes(na)) sim += 0.1;

  return Math.min(1, Math.max(0, sim));
}

// Zwraca top 3 najpodobniejszych drużyn z API - przyda się w UI jako
// alternatywa do wyboru, nawet gdy główne dopasowanie jest pewne.
function top3Sugestii(nazwa, listaApi) {
  return listaApi
    .map((a) => ({ team: a, sim: podobienstwo(nazwa, a.name || '') }))
    .sort((x, y) => y.sim - x.sim)
    .slice(0, 3)
    .map((r) => ({ id: r.team.id, name: r.team.name, confidence: r.sim }));
}

// Główny pipeline auto-mapowania.
//
// Zwraca: { matched, confidence, suggestions, source }
//   - matched: { id, name } | null - finalna sugestia (auto-akceptowana
//     w "high"/"dictionary"/"exact", do potwierdzenia w "fuzzy_medium").
//   - confidence: 0..1
//   - suggestions: top 3 fuzzy - admin może wybrać inną w UI
//   - source: 'dictionary' | 'exact' | 'fuzzy_high' | 'fuzzy_medium' | 'none'
export function dopasowDruzyne(nazwaWBazie, listaApi) {
  if (!Array.isArray(listaApi) || listaApi.length === 0) {
    return { matched: null, confidence: 0, suggestions: [], source: 'none' };
  }

  // Krok 1: słownik reprezentacji. Tłumaczymy "Argentyna" -> "Argentina"
  // i szukamy w API po przetłumaczonej nazwie (case-insensitive).
  const tlumaczenie = przetlumaczNaAngielski(nazwaWBazie);
  if (tlumaczenie) {
    const trafienie = listaApi.find(
      (a) => (a.name || '').toLowerCase() === tlumaczenie.toLowerCase(),
    );
    if (trafienie) {
      return {
        matched: { id: trafienie.id, name: trafienie.name },
        confidence: 1,
        suggestions: top3Sugestii(nazwaWBazie, listaApi),
        source: 'dictionary',
      };
    }
  }

  // Krok 2: dokładny match case-insensitive (głównie kluby, których nazwa
  // w bazie jest oryginalna - "Manchester United FC" w obu miejscach).
  const direct = listaApi.find(
    (a) => (a.name || '').toLowerCase() === String(nazwaWBazie || '').toLowerCase(),
  );
  if (direct) {
    return {
      matched: { id: direct.id, name: direct.name },
      confidence: 1,
      suggestions: top3Sugestii(nazwaWBazie, listaApi),
      source: 'exact',
    };
  }

  // Krok 3: fuzzy matching po normalizacji.
  const ranking = listaApi
    .map((a) => ({ team: a, sim: podobienstwo(nazwaWBazie, a.name || '') }))
    .sort((x, y) => y.sim - x.sim);

  const top = ranking[0];
  const suggestions = ranking.slice(0, 3).map((r) => ({
    id: r.team.id,
    name: r.team.name,
    confidence: r.sim,
  }));

  if (!top || top.sim < 0.6) {
    return { matched: null, confidence: top?.sim ?? 0, suggestions, source: 'none' };
  }
  if (top.sim >= 0.85) {
    return {
      matched: { id: top.team.id, name: top.team.name },
      confidence: top.sim,
      suggestions,
      source: 'fuzzy_high',
    };
  }
  return {
    matched: { id: top.team.id, name: top.team.name },
    confidence: top.sim,
    suggestions,
    source: 'fuzzy_medium',
  };
}

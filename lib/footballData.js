// Klient Football-Data.org (https://www.football-data.org/).
// Każde wywołanie zwraca jednolity kształt:
//   { success: true,  data: ... }
//   { success: false, error: 'opis czytelny po polsku', status?: 4xx|5xx }
//
// W pamięci procesu trzymamy 30-sekundowy cache odpowiedzi (Map url -> payload).
// Cel: nie palić limitu 10 req/min, gdy w jednej operacji admina (np. otwarcie
// strony /admin/mecze/mapowanie) potrzebujemy tej samej listy meczów kilka razy
// pod rząd. Cache jest per-instancja serverless - po cold-starcie startuje pusty,
// co jest OK przy 30s TTL.

const BASE = 'https://api.football-data.org/v4';
const CACHE_TTL_MS = 30_000;

const cache = new Map(); // url -> { expiresAt, payload }

function odczytajCache(url) {
  const wpis = cache.get(url);
  if (!wpis) return null;
  if (wpis.expiresAt < Date.now()) {
    cache.delete(url);
    return null;
  }
  return wpis.payload;
}

function zapiszCache(url, payload) {
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

async function wywolaj(path) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Brak FOOTBALL_DATA_API_KEY w zmiennych środowiskowych.' };
  }

  const url = `${BASE}${path}`;
  const cached = odczytajCache(url);
  if (cached) return { success: true, data: cached, cached: true };

  let resp;
  try {
    resp = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      cache: 'no-store',
    });
  } catch (e) {
    return {
      success: false,
      error: `Brak łączności z Football-Data.org: ${e?.message || 'unknown'}`,
    };
  }

  if (resp.status === 429) {
    return {
      success: false,
      status: 429,
      error: 'Przekroczony limit Football-Data.org (10 req/min). Spróbuj za minutę.',
    };
  }
  if (resp.status === 401 || resp.status === 403) {
    return {
      success: false,
      status: resp.status,
      error: 'Football-Data.org odrzucił klucz API (401/403). Sprawdź FOOTBALL_DATA_API_KEY.',
    };
  }
  if (resp.status >= 400 && resp.status < 500) {
    let info = '';
    try {
      info = (await resp.json())?.message || '';
    } catch {}
    return {
      success: false,
      status: resp.status,
      error: `Football-Data.org ${resp.status}: ${info || 'błąd zapytania'}.`,
    };
  }
  if (resp.status >= 500) {
    return {
      success: false,
      status: resp.status,
      error: `Football-Data.org chwilowo niedostępne (${resp.status}). Spróbuj później.`,
    };
  }

  let payload;
  try {
    payload = await resp.json();
  } catch {
    return { success: false, error: 'Nieczytelna odpowiedź z API (nie-JSON).' };
  }

  zapiszCache(url, payload);
  return { success: true, data: payload };
}

// Lista meczów competycji (domyślnie 'WC' = mistrzostwa świata).
// Endpoint: /v4/competitions/{code}/matches
// Zwraca tablicę meczów (odpakowane z { matches: [...] }).
//
// Domyślnie filtrujemy po stronie API: tylko przyszłe i trwające (SCHEDULED,
// TIMED, IN_PLAY, PAUSED, EXTRA_TIME, PENALTY_SHOOTOUT). Dzięki temu import
// nie zaciąga historycznych meczów (np. cały sezon Premier League sprzed roku).
// Aby pobrać wszystko (np. żeby wciągnąć historię), przekaż { tylkoPrzyszle: false }.
export async function pobierzMecze(competition = 'WC', opcje = { tylkoPrzyszle: true }) {
  let path = `/competitions/${competition}/matches`;
  if (opcje?.tylkoPrzyszle !== false) {
    path += '?status=SCHEDULED,TIMED,IN_PLAY,PAUSED,LIVE';
  }
  const wynik = await wywolaj(path);
  if (!wynik.success) return wynik;
  return { success: true, data: wynik.data?.matches ?? [], cached: wynik.cached };
}

// Lista drużyn competycji.
// Endpoint: /v4/competitions/{code}/teams
// Zwraca tablicę drużyn (odpakowane z { teams: [...] }).
export async function pobierzZespoly(competition = 'WC') {
  const wynik = await wywolaj(`/competitions/${competition}/teams`);
  if (!wynik.success) return wynik;
  return { success: true, data: wynik.data?.teams ?? [], cached: wynik.cached };
}

// Pobiera mecze po liście external_id (Football-Data id). Pozwala
// w cronie sprawdzić wszystkie nasze mecze jednym strzałem zamiast
// kolejno po każdej competycji.
// Endpoint: /v4/matches?ids=ID1,ID2,...
// Limit po stronie API na URL ~ przyjmijmy bezpieczny próg 50 ID na call.
export async function pobierzMeczePoIds(ids) {
  if (!ids || ids.length === 0) return { success: true, data: [] };

  const ROZMIAR = 50;
  const wszystkie = [];
  for (let i = 0; i < ids.length; i += ROZMIAR) {
    const partia = ids.slice(i, i + ROZMIAR).join(',');
    const wynik = await wywolaj(`/matches?ids=${partia}`);
    if (!wynik.success) return wynik;
    wszystkie.push(...(wynik.data?.matches ?? []));
  }
  return { success: true, data: wszystkie };
}

// Mapuje status z Football-Data.org na nasze 'scheduled'/'live'/'finished'.
// Statusy z API: SCHEDULED, TIMED, IN_PLAY, PAUSED, EXTRA_TIME,
// PENALTY_SHOOTOUT, FINISHED, SUSPENDED, POSTPONED, CANCELLED, AWARDED.
// Zwraca null dla statusów, których nie tłumaczymy (UI pokazuje stary).
export function statusZApi(apiStatus) {
  switch (apiStatus) {
    case 'IN_PLAY':
    case 'PAUSED':
    case 'EXTRA_TIME':
    case 'PENALTY_SHOOTOUT':
    case 'LIVE':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    default:
      return null;
  }
}

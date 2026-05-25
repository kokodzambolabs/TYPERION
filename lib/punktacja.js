// Czysta funkcja punktacji typu meczowego.
// Zero side effects - tylko obliczenie. Łatwa do testowania.
//
// Zasady:
//   3 pkt - dokładny wynik (np. typ 2:1, wynik 2:1)
//   2 pkt - poprawna różnica goli i nie remis
//           (np. typ 2:0, wynik 3:1 - obie różnice = 2; ale dla remisu nie liczy)
//   1 pkt - poprawny rezultat (ten sam zwycięzca lub remis), ale inne wartości
//   0 pkt - pudło
//
// Przykłady:
//   policzPunkty({home:2,away:1}, {home:2,away:1}) === 3
//   policzPunkty({home:2,away:0}, {home:3,away:1}) === 2
//   policzPunkty({home:2,away:1}, {home:3,away:0}) === 1
//   policzPunkty({home:1,away:1}, {home:2,away:2}) === 1
//   policzPunkty({home:2,away:1}, {home:0,away:1}) === 0

export function policzPunkty(typ, wynik) {
  // Dokładny wynik - 3 pkt.
  if (typ.home === wynik.home && typ.away === wynik.away) {
    return 3;
  }

  const roznicaTyp = typ.home - typ.away;
  const roznicaWynik = wynik.home - wynik.away;

  // Poprawna różnica goli i nie remis - 2 pkt.
  if (roznicaTyp === roznicaWynik && roznicaTyp !== 0) {
    return 2;
  }

  // Poprawny rezultat (ten sam zwycięzca lub remis) - 1 pkt.
  if (Math.sign(roznicaTyp) === Math.sign(roznicaWynik)) {
    return 1;
  }

  // Pudło.
  return 0;
}

// Rozliczenie typu meczowego z uwzględnieniem fazy pucharowej i bonusu za awansującego.
// Przyjmuje typ i pełny obiekt meczu (z group_name, winner_team_id, full_time_*, home_score, away_score).
// W fazie pucharowej używa wynik 90min (full_time_*), w grupowej normalny home/away_score.
//
// Zwraca: liczba punktów (0-4) albo null jeśli wynik 90min nie jest dostępny dla pucharowego.
export function policzPunktyMeczu(typ, mecz) {
  const { czyPucharowy } = require('@/lib/helpers/etapMeczu');
  const pucharowy = czyPucharowy(mecz.group_name);

  // Wybierz wynik do porównania
  let realHome, realAway;
  if (pucharowy) {
    // Faza pucharowa - używamy wynik 90min
    realHome = mecz.full_time_home_score;
    realAway = mecz.full_time_away_score;
    // Guard: jeśli full_time_* nie są jeszcze wpisane (cron jeszcze nie aktualizował), zwracamy null
    if (realHome == null || realAway == null) {
      return null;
    }
  } else {
    // Faza grupowa - normalny wynik
    realHome = mecz.home_score;
    realAway = mecz.away_score;
  }

  // Punkty z wyniku (3/2/1/0)
  const wynik = { home: realHome, away: realAway };
  let punkty = policzPunkty({ home: typ.home_score, away: typ.away_score }, wynik);

  // Bonus +1 za awansującego (tylko pucharowy + remis 90min)
  if (
    pucharowy &&
    realHome === realAway && // remis w 90min
    typ.home_score === typ.away_score && // user też obstawił remis
    typ.winner_team_id != null && // user wskazał awansującego
    mecz.winner_team_id != null && // mecz ma wyznaczonego zwycięzcę
    typ.winner_team_id === mecz.winner_team_id // trafiony awansujący
  ) {
    punkty += 1;
  }

  return punkty;
}


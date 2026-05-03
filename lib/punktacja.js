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

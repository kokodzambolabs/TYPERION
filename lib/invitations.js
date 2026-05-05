// Helper do kodów zaproszeń.
// Format: TYPER-XXXX-XXXX (np. TYPER-W2X9-K3FT). Wielkie litery i cyfry,
// bez znaków łatwych do pomylenia: 0/O, 1/I/L.

import { randomBytes } from 'node:crypto';

const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generujKod() {
  return `TYPER-${segment(4)}-${segment(4)}`;
}

function segment(dlugosc) {
  // randomBytes daje losowość kryptograficzną - rejection sampling
  // (skip > 31*8) gwarantuje równomierny rozkład wśród 31 znaków alfabetu.
  const wynik = [];
  while (wynik.length < dlugosc) {
    const bufor = randomBytes(dlugosc - wynik.length);
    for (const bajt of bufor) {
      if (bajt >= 31 * 8) continue;
      wynik.push(ALFABET[bajt % 31]);
      if (wynik.length === dlugosc) break;
    }
  }
  return wynik.join('');
}

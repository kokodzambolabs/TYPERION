// Wyciąga JSON {home, away} z surowego tekstu odpowiedzi AI.
// Obsługuje:
//   - sam JSON,
//   - JSON wewnątrz bloku ```json ... ```,
//   - JSON wewnątrz dowolnego tekstu (regex zachłanny po pierwszym '{ home').
//
// Rzuca błąd jeśli nie znajdzie prawidłowego JSONa - Server Action zaloguje
// raw_response do ai_typing_logs i zwróci komunikat dla admina.

export function parsujOdpowiedzAI(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI zwróciło pustą odpowiedź.');
  }

  // Najpierw spróbuj wyciągnąć ostatni blok JSON pasujący do schematu.
  // Bierzemy ostatni, bo deep_research może wewnątrz analizy referować
  // inne JSONy, a finalna decyzja jest na końcu.
  const matches = rawText.match(/\{[^{}]*"home"[^{}]*\}/g);
  let kandydat = matches?.[matches.length - 1];

  // Fallback: zachłanny match na wypadek zagnieżdżonych nawiasów.
  if (!kandydat) {
    const greedy = rawText.match(/\{[\s\S]*?"home"[\s\S]*?\}/);
    kandydat = greedy?.[0];
  }

  if (!kandydat) {
    throw new Error('Nie znaleziono JSON w odpowiedzi AI.');
  }

  let parsed;
  try {
    parsed = JSON.parse(kandydat);
  } catch (e) {
    throw new Error(`Niepoprawny JSON w odpowiedzi AI: ${e.message}`);
  }

  if (
    typeof parsed.home !== 'number' ||
    typeof parsed.away !== 'number' ||
    !Number.isInteger(parsed.home) ||
    !Number.isInteger(parsed.away) ||
    parsed.home < 0 ||
    parsed.home > 10 ||
    parsed.away < 0 ||
    parsed.away > 10
  ) {
    throw new Error('JSON ma niepoprawne wartości home/away.');
  }

  return {
    home: parsed.home,
    away: parsed.away,
  };
}

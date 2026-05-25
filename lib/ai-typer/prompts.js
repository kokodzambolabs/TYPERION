// Szablony promptów do AI typowania meczów - per provider.
// Claude: PROMPT_CLAUDE_DEEP (deep_research) / PROMPT_CLAUDE_QUICK (quick).
// Gemini: PROMPT_GEMINI_DEEP - prosi o krótkie podsumowanie + JSON na końcu.
//   Wymuszanie samego JSON-a (responseMimeType) wyłączało thinking, więc
//   pozwalamy modelowi pisać tekst - parser bierze ostatni blok pasujący
//   do schematu {"home":..,"away":..}.
// GPT: PROMPT_GPT_CASUAL - prosty prompt do bota baseline (GPT-5-mini),
//   wywoływany 100x z temp 0.7 - bierzemy dominantę odpowiedzi.

const PROMPT_CLAUDE_DEEP = `Jesteś profesjonalnym analitykiem piłkarskim. Twoje predykcje muszą być najwyższej jakości.

MECZ: {home_team} vs {away_team}
Data: {kickoff_date}
Turniej: {competition_name} {group_info}

ANALIZA (użyj web_search dla świeżych danych):

1. FORMA: Sprawdź formę obu drużyn z ostatnich 5-10 meczów.
   Skuteczność ofensywna i defensywna.

2. SKŁADY: Kluczowi zawodnicy, kontuzje, zawieszenia w
   ostatnich tygodniach.

3. STYL GRY: Jak grają obie drużyny, kto ma przewagę
   taktyczną w tym match-upie.

4. KONTEKST: Znaczenie meczu, miejsce w tabeli, presja
   na obie strony.

Po analizie podaj WYŁĄCZNIE finalny JSON:
{"home": liczba (0-10), "away": liczba (0-10)}

Bądź konkretny i decyzyjny. Wybierz najbardziej
prawdopodobny wynik.`;

const PROMPT_CLAUDE_QUICK = `
Mecz: {home_team} vs {away_team}
{competition_name} {group_info}

Szybkie typowanie wyniku. Spójrz kto gra i podaj wynik.

Zwróć WYŁĄCZNIE JSON:
{
  "home": liczba (0-10),
  "away": liczba (0-10)
}
`;

const PROMPT_GEMINI_DEEP = `Jesteś elitarnym analitykiem piłkarskim (Sky Sports, Opta, StatsBomb). Twoje predykcje muszą być najwyższej jakości.

ZADANIE:
Przeprowadź dogłębną analizę i wytypuj wynik meczu.

MECZ: {home_team} vs {away_team}
Data: {kickoff_date}
Turniej: {competition_name} {group_info}

INSTRUKCJA ANALIZY:
1. DANE ŚWIEŻE: Bezwzględnie użyj Google Search, aby pobrać najnowsze informacje: forma z ostatnich meczów, kontuzje, składy, nastroje w drużynach.
2. TAKTYKA: Przeanalizuj style gry i kluczowe match-upy.
3. Przedstaw krótkie, jednoakapitowe podsumowanie kluczowych wniosków ze statystyk i wyszukiwania.

FORMAT FINALNY:
Na samym końcu odpowiedzi umieść dedykowany blok z obiektem JSON zawierającym ostateczny typ. Użyj formatu:
{"home": INTEGER, "away": INTEGER}`;

const PROMPT_GPT_CASUAL = `Mecz: {home_team} vs {away_team}
Data: {kickoff_date}
Turniej: {competition_name} {group_info}

Jaki będzie wynik tego meczu?

Zwróć WYŁĄCZNIE JSON:
{"home": liczba (0-10), "away": liczba (0-10)}`;

export function getPrompt(provider, promptType, matchData) {
  let template;

  if (provider === 'anthropic') {
    template = promptType === 'quick' ? PROMPT_CLAUDE_QUICK : PROMPT_CLAUDE_DEEP;
  } else if (provider === 'google') {
    template = PROMPT_GEMINI_DEEP;
  } else if (provider === 'openai') {
    template = PROMPT_GPT_CASUAL;
  } else {
    throw new Error(`Nieznany provider: ${provider}`);
  }

  let prompt = template
    .replaceAll('{home_team}', matchData.homeTeam || '')
    .replaceAll('{away_team}', matchData.awayTeam || '')
    .replaceAll('{kickoff_date}', matchData.kickoffDate || '')
    .replaceAll('{competition_name}', matchData.competitionName || '')
    .replaceAll('{group_info}', matchData.groupInfo || '')
    .trim();

  // Dodaj UWAGĘ dla meczów fazy pucharowej
  if (matchData.pucharowy) {
    const uwaga = '\n\nUWAGA: To mecz fazy pucharowej. Typujesz wynik regulaminowego czasu (90 minut). Dogrywka i karne nie wpływają na punktację meczową.';
    // Wstaw przed ostatnim JSON-em (jeśli jest) lub na końcu
    const lastBrace = prompt.lastIndexOf('{');
    if (lastBrace > 0 && prompt.substring(lastBrace).match(/^{.*}$/)) {
      prompt = prompt.substring(0, lastBrace) + uwaga + '\n' + prompt.substring(lastBrace);
    } else {
      prompt += uwaga;
    }
  }

  return prompt;
}

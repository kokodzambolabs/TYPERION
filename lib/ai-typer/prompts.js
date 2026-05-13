// Szablony promptów do AI typowania meczów - per provider.
// Claude: PROMPT_CLAUDE_DEEP (deep_research) / PROMPT_CLAUDE_QUICK (quick).
// Gemini: PROMPT_GEMINI_DEEP - zwięzły, eksplicytnie nakazuje ukrycie
//   thinking i zwrot CZYSTEGO JSON-a (parser i tak by sobie poradził, ale
//   chcemy żeby model nie marnował output tokens na markdown).
// GPT: PROMPT_GPT_DEEP - placeholder do uzupełnienia gdy podepniemy OpenAI.
//
// Parser (parser.js) jest tolerancyjny na blok ```json, więc obie konwencje
// (markdown vs czysty JSON) zadziałają - ale dla Gemini eksplicytnie żądamy
// czystego JSON-a, żeby ograniczyć zużycie tokenów.

const PROMPT_CLAUDE_DEEP = `
ultrathink

Jesteś profesjonalnym analitykiem piłkarskim z 20-letnim
stażem w Sky Sports. Specjalizujesz się w przewidywaniu
wyników meczów na poziomie eksperckim.

ZADANIE: Przeprowadź WIELOETAPOWĄ, GŁĘBOKĄ analizę
przewidującą wynik tego meczu.

MECZ:
{home_team} vs {away_team}
Data: {kickoff_date}
Turniej: {competition_name}
{group_info}

WYMAGANE ETAPY ANALIZY (wykonaj WSZYSTKIE krok po kroku):

KROK 1: AKTUALNA FORMA
Przeanalizuj formę obu drużyn z ostatnich 10 meczów.
Ile zwycięstw, remisów, porażek? Tendencja rośnie czy spada?
Ile bramek strzelonych i straconych?

KROK 2: HEAD-TO-HEAD
Jak wyglądała historia bezpośrednich spotkań w ostatnich
10 meczach? Średni wynik? Czy któraś drużyna dominuje?

KROK 3: KLUCZOWI ZAWODNICY
Kim są kluczowi zawodnicy obu drużyn? Czy są kontuzjowani
lub zawieszeni? Jak ich obecność/brak wpłynie na wynik?

KROK 4: STYL GRY I TAKTYKA
Jaki styl gry preferuje każda z drużyn? (pressing wysoki /
gra z kontry / posiadanie / długa piłka). Jaki match-up
wygenerują tym razem?

KROK 5: STATYSTYKI
xG (expected goals), liczba strzałów, posiadanie, dośrodkowania,
drużynowe wskaźniki defensywne i ofensywne.

KROK 6: KONTEKST MECZU
Co dla każdej drużyny oznacza ten mecz? Walka o tytuł,
o utrzymanie, o awans? Pozycja w tabeli? Presja?

KROK 7: HISTORYCZNE WZORCE
Czy podobne konfiguracje (forma, miejsce, znaczenie) w
przeszłości dawały konkretne wyniki? Jaki typ meczu się
zarysowuje?

KROK 8: SCENARIUSZE
Stwórz 3 możliwe scenariusze wyniku z prawdopodobieństwem.
Wybierz NAJBARDZIEJ PRAWDOPODOBNY z poparciem analizy.

KROK 9: WERYFIKACJA
Sprawdź swoją predykcję - czy uwzględniłeś WSZYSTKIE czynniki?
Czy nie kierujesz się tylko jednym aspektem? Czy jest realny?

PO PEŁNEJ ANALIZIE podaj WYŁĄCZNIE JSON:
{
  "home": liczba_goli (0-7),
  "away": liczba_goli (0-7)
}

UWAGA KRYTYCZNA:
- NIE skracaj analizy - każdy krok wymaga przemyślenia
- NIE zgaduj - opieraj się na rzetelnych przesłankach
- Twoja reputacja eksperta zależy od tej predykcji
- Think extremely carefully before deciding
- Rozważ KAŻDY krok zanim wydasz finalny werdykt
`;

const PROMPT_CLAUDE_QUICK = `
Mecz: {home_team} vs {away_team}
{competition_name} {group_info}

Szybkie typowanie wyniku. Spójrz kto gra i podaj wynik.

Zwróć WYŁĄCZNIE JSON:
{
  "home": liczba (0-7),
  "away": liczba (0-7)
}
`;

const PROMPT_GEMINI_DEEP = `Jesteś elitarnym analitykiem piłkarskim (Sky Sports, Opta, StatsBomb). Twoje predykcje muszą być najwyższej jakości.

ZADANIE:
Przeprowadź głęboką analizę (thinking process) i wytypuj wynik meczu.
MECZ: {home_team} vs {away_team}
Data: {kickoff_date}
Turniej: {competition_name} {group_info}

INSTRUKCJA ANALIZY (WEWNĘTRZNA):
1. DANE ŚWIEŻE: Użyj Google Search (grounding), aby sprawdzić: formę (10 meczów), kontuzje/zawieszenia, H2H, aktualne nastroje w sztabach.
2. TAKTYKA: Przeanalizuj style gry, xG (expected goals), match-up trenerów i formę kluczowych zawodników.
3. KONTEKST: Ranga meczu, pogoda, sędzia, stadion.
4. SYMULACJA: Przeprowadź wewnętrznie 3 scenariusze (pesymistyczny, optymistyczny, realistyczny).

ZASADY ODPOWIEDZI:
- Twój proces myślowy musi być całkowicie ukryty.
- ZWRÓĆ WYŁĄCZNIE CZYSTY OBIEKT JSON.
- Zakaz używania markdown (\`\`\`json ... \`\`\`), zakaz wstępów, zakaz podsumowań.

FORMAT WYJŚCIOWY:
{"home": INTEGER, "away": INTEGER}`;

const PROMPT_GPT_DEEP = `[PROMPT GPT - DO UZUPEŁNIENIA]

Mecz: {home_team} vs {away_team}
Data: {kickoff_date}
Turniej: {competition_name} {group_info}

Zwróć WYŁĄCZNIE JSON:
{"home": INTEGER, "away": INTEGER}`;

export function getPrompt(provider, promptType, matchData) {
  let template;

  if (provider === 'anthropic') {
    template = promptType === 'quick' ? PROMPT_CLAUDE_QUICK : PROMPT_CLAUDE_DEEP;
  } else if (provider === 'google') {
    template = PROMPT_GEMINI_DEEP;
  } else if (provider === 'openai') {
    template = PROMPT_GPT_DEEP;
  } else {
    throw new Error(`Nieznany provider: ${provider}`);
  }

  return template
    .replaceAll('{home_team}', matchData.homeTeam || '')
    .replaceAll('{away_team}', matchData.awayTeam || '')
    .replaceAll('{kickoff_date}', matchData.kickoffDate || '')
    .replaceAll('{competition_name}', matchData.competitionName || '')
    .replaceAll('{group_info}', matchData.groupInfo || '')
    .trim();
}

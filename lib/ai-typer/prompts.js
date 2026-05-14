// Szablony promptów do AI typowania meczów - per provider.
// Claude: PROMPT_CLAUDE_DEEP (deep_research) / PROMPT_CLAUDE_QUICK (quick).
// Gemini: PROMPT_GEMINI_DEEP - prosi o krótkie podsumowanie + JSON na końcu.
//   Wymuszanie samego JSON-a (responseMimeType) wyłączało thinking, więc
//   pozwalamy modelowi pisać tekst - parser bierze ostatni blok pasujący
//   do schematu {"home":..,"away":..}.
// GPT: PROMPT_GPT_DEEP - placeholder do uzupełnienia gdy podepniemy OpenAI.

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

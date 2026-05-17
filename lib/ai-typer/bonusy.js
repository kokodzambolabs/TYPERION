// Generowanie odpowiedzi botów AI na pytania bonusowe.
// Wzorzec analogiczny do generujTypAI dla meczów, ale prompt
// jest budowany per typ pytania, a parser oczekuje JSON
// {"odpowiedz": "dokładny tekst opcji"}.
//
// Boty NIE wybierają "Inny" w dropdown_other - musimy zmusić je do
// wyboru jednej z opcji z listy (inaczej rozliczenie ich nie zmatchuje).

import { wywolajClaude } from './anthropic';
import { wywolajGemini } from './gemini';
import { wywolajOpenAI } from './openai';
import { obliczKoszt } from './koszt';

// ---------------------------------------------------------------------
// Prompt builder.
// Dla dropdown_weighted / dropdown_other - lista opcji z numerami,
// bot MUSI zwrócić dokładny tekst jednej z opcji (verbatim).
// Dla boolean_weighted - bot wybiera TAK lub NIE.
// ---------------------------------------------------------------------
export function zbudujPromptBonusowy(pytanie, opcje) {
  const opcjeTekst = opcje
    .filter((o) => o.opcja_text?.toUpperCase() !== 'INNY')
    .map((o, i) => `  ${i + 1}. "${o.opcja_text}"`)
    .join('\n');

  const nazwaTurnieju = 'Mistrzostwa Świata 2026 w piłce nożnej (16 jun – 19 lip 2026, USA/Kanada/Meksyk)';

  let instrukcja;
  if (pytanie.question_type === 'boolean_weighted') {
    instrukcja = `Odpowiedz TAK lub NIE - wybierz to, co uważasz za najbardziej prawdopodobne.

Dostępne odpowiedzi (musisz zwrócić DOKŁADNIE jeden z poniższych tekstów verbatim):
${opcjeTekst}`;
  } else if (
    pytanie.question_type === 'dropdown_weighted' ||
    pytanie.question_type === 'dropdown_other'
  ) {
    instrukcja = `Wybierz JEDNĄ odpowiedź z poniższej listy. Zwróć DOKŁADNY tekst opcji verbatim (kopiuj 1:1):

${opcjeTekst}

Nie wymyślaj własnych odpowiedzi. Musisz wybrać jedną z opcji powyżej.`;
  } else {
    instrukcja = `Odpowiedz krótko (1-3 słowa).`;
  }

  return `Jesteś analitykiem piłkarskim. Odpowiadasz na pytanie bonusowe w typowaniu na ${nazwaTurnieju}.

PYTANIE: ${pytanie.text}
${pytanie.description ? `OPIS: ${pytanie.description}\n` : ''}
${instrukcja}

Po krótkiej analizie zwróć WYŁĄCZNIE finalny JSON w formacie:
{"odpowiedz": "dokładny tekst odpowiedzi"}`;
}

// ---------------------------------------------------------------------
// Parser - wyciąga JSON {"odpowiedz": "..."} z odpowiedzi AI.
// Lista valid - upewnia się, że bot wybrał z dozwolonych opcji.
// ---------------------------------------------------------------------
export function parsujOdpowiedzBonusowa(rawText, validOpcje) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI zwróciło pustą odpowiedź.');
  }

  // Bierzemy ostatni blok JSON z polem "odpowiedz" — model może
  // wcześniej referować inne fragmenty.
  const matches = rawText.match(/\{[^{}]*"odpowiedz"[\s\S]*?\}/g);
  let kandydat = matches?.[matches.length - 1];

  if (!kandydat) {
    throw new Error('Nie znaleziono JSON-a z polem "odpowiedz".');
  }

  let parsed;
  try {
    parsed = JSON.parse(kandydat);
  } catch (e) {
    throw new Error(`Niepoprawny JSON w odpowiedzi AI: ${e.message}`);
  }

  const odp = typeof parsed.odpowiedz === 'string' ? parsed.odpowiedz.trim() : '';
  if (!odp) throw new Error('Pole "odpowiedz" puste.');

  // Match exact (case-insensitive, po przycięciu) z listą dozwolonych opcji.
  const validList = validOpcje
    .map((o) => o.opcja_text)
    .filter((t) => t && t.toUpperCase() !== 'INNY');

  const trafienie = validList.find(
    (t) => t.toLowerCase() === odp.toLowerCase(),
  );

  if (!trafienie) {
    throw new Error(
      `Odpowiedź "${odp}" nie pasuje do listy opcji (${validList.join(' | ')}).`,
    );
  }

  return { odpowiedz: trafienie };
}

// ---------------------------------------------------------------------
// Główne wejście: bot × pytanie → odpowiedź.
// Reuse'uje providerów z generujTypAI - ten sam routing po ai_provider.
// ---------------------------------------------------------------------
export async function generujOdpowiedzBonusowaAI(botProfile, pytanie, opcje) {
  let promptType = botProfile.ai_prompt_type;
  let withThinking = false;
  if (promptType === 'deep_research_thinking') {
    promptType = 'deep_research';
    withThinking = true;
  }

  const prompt = zbudujPromptBonusowy(pytanie, opcje);

  let result;
  if (botProfile.ai_provider === 'anthropic') {
    result = await wywolajClaude(botProfile.ai_model, prompt, { withThinking });
  } else if (botProfile.ai_provider === 'google') {
    result = await wywolajGemini(botProfile.ai_model, prompt);
  } else if (botProfile.ai_provider === 'openai') {
    // OpenAI dla typowania meczów robi 100 zapytań i bierze dominantę.
    // Dla bonusów trzymamy tę samą logikę - openai.js wraca z text=JSON
    // pseudo {"home":..., "away":...}, więc dla bonusów potrzebujemy
    // wariantu, który NIE zakłada formatu home/away. Tu po prostu
    // pojedyncze wywołanie OpenAI bez agregacji.
    result = await wywolajOpenAISingle(botProfile.ai_model, prompt);
  } else {
    throw new Error(`Nieznany provider: ${botProfile.ai_provider}`);
  }

  let parsed;
  try {
    parsed = parsujOdpowiedzBonusowa(result.text, opcje);
  } catch (e) {
    const err = new Error(e.message);
    err.rawResponse = result.text;
    err.tokensInput = result.tokensInput;
    err.tokensOutput = result.tokensOutput;
    err.promptUsed = prompt;
    throw err;
  }

  const cost = obliczKoszt(
    botProfile.ai_model,
    result.tokensInput,
    result.tokensOutput,
  );

  return {
    odpowiedz: parsed.odpowiedz,
    rawResponse: result.text,
    promptUsed: prompt,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: cost,
  };
}

// Pojedyncze wywołanie OpenAI (bez agregacji 100x z openai.js, która
// jest specyficzna dla home/away typowania meczów). Dla bonusów wybór
// jest jakościowy — jedna decyzja wystarczy.
async function wywolajOpenAISingle(model, prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Brak OPENAI_API_KEY w env.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0,
  };
}

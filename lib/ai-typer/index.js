// Główne wejście modułu AI typera.
// generujTypAI(botProfile, matchData) -> {home, away, ...}
// Routing po providerze (anthropic / google), parsowanie JSONa i kalkulacja kosztu.

import { wywolajClaude } from './anthropic';
import { wywolajGemini } from './gemini';
import { getPrompt } from './prompts';
import { parsujOdpowiedzAI } from './parser';
import { obliczKoszt } from './koszt';

export async function generujTypAI(botProfile, matchData) {
  // botProfile: { ai_provider, ai_model, ai_prompt_type }
  // matchData: { homeTeam, awayTeam, kickoffDate, competitionName, groupInfo }

  // 'deep_research_thinking' używa tego samego promptu co 'deep_research',
  // ale wywołuje model z extended thinking (tylko Anthropic Opus 4.x / Sonnet 4.5+).
  let promptType = botProfile.ai_prompt_type;
  let withThinking = false;
  if (promptType === 'deep_research_thinking') {
    promptType = 'deep_research';
    withThinking = true;
  }

  const prompt = getPrompt(promptType, matchData);

  let result;
  if (botProfile.ai_provider === 'anthropic') {
    result = await wywolajClaude(botProfile.ai_model, prompt, { withThinking });
  } else if (botProfile.ai_provider === 'google') {
    result = await wywolajGemini(botProfile.ai_model, prompt);
  } else {
    throw new Error(`Nieznany provider: ${botProfile.ai_provider}`);
  }

  let parsed;
  try {
    parsed = parsujOdpowiedzAI(result.text);
  } catch (e) {
    // Wzbogacamy błąd o surową odpowiedź, żeby Server Action mógł
    // zalogować ją do ai_typing_logs (raw_response) - admin zobaczy
    // co AI wypluło i zdecyduje czy zmienić prompt.
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
    home: parsed.home,
    away: parsed.away,
    rawResponse: result.text,
    promptUsed: prompt,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: cost,
  };
}

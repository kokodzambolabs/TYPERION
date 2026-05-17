// Wywołanie Gemini przez REST API (Generative Language API, czysty fetch).
// Z retry + exponential backoff dla 503/429 i błędów sieciowych - Gemini
// 3.1 Pro Preview często zwraca "high demand" / "fetch failed".
//
// Retry: do 5 prób, backoff 5s / 15s / 30s / 60s / 120s (max ~230s czekania).
//   - 503 (overloaded) i 429 (rate limit)  -> retry
//   - inne 4xx                              -> NIE retry, rzuć błąd od razu
//   - błędy sieciowe (fetch failed itp.)    -> retry
//
// Thinking: seria Gemini 3.x używa thinkingLevel ("low"|"medium"|"high")
// zamiast starego thinkingBudget. NIE wolno wysłać obu naraz - API zwraca 400.
// "high" = głębokie myślenie, zalecane dla typowania meczów.
// includeThoughts=false bo interesuje nas tylko finalny JSON.
//
// Google Search Grounding: tool googleSearch pozwala Gemini pobrać aktualne
// dane (forma drużyn, kontuzje, składy) przed odpowiedzią. Tier free Gemini
// daje 1500 wyszukań/dzień - dla całego turnieju MŚ (~104 mecze, 3-10 search
// per mecz) mieścimy się w darmowym limicie z zapasem.
//
// BEZ responseMimeType: wcześniej wymuszaliśmy "application/json" - okazało
// się że to całkowicie wyłącza thinking (model zwraca goły JSON, 18 output
// tokens, 0 thinking). Parser i tak wyciąga JSON z dowolnego tekstu, więc
// pozwalamy modelowi pisać podsumowanie + JSON na końcu - thinking budget
// jest realnie zużywany.
//
// tokensOutput zwracane = candidatesTokenCount + thoughtsTokenCount. Bez
// thoughtsTokenCount koszt myslenia byl zerowany, ale Google bilingowo i
// tak liczy thinking tokens jak output - musi być w sumie.
//
// maxOutputTokens podbite do 32000, żeby thinking + odpowiedź się zmieściły.

const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000]; // 5s, 15s, 30s, 60s, 120s

function jestBladSieciowy(message) {
  if (!message) return false;
  return (
    message.includes('fetch failed') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT')
  );
}

export async function wywolajGemini(model, prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Brak GEMINI_API_KEY w env.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      maxOutputTokens: 32000,
      temperature: 0.7,
      thinkingConfig: {
        thinkingLevel: 'high',
        includeThoughts: false,
      },
    },
  };

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("--- START GROUNDING METADATA ---");
        console.log(JSON.stringify(data.candidates[0]?.groundingMetadata, null, 2));
        console.log("--- KONIEC GROUNDING METADATA ---");
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts
          .map((p) => p?.text || '')
          .filter(Boolean)
          .join('\n');

        const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
        const thinkingTokens = data.usageMetadata?.thoughtsTokenCount ?? 0;

        console.log(
          `[gemini] tokens: thinking=${thinkingTokens}, output=${outputTokens}, total=${outputTokens + thinkingTokens}`,
        );

        return {
          text,
          tokensInput: data.usageMetadata?.promptTokenCount ?? 0,
          tokensOutput: outputTokens + thinkingTokens,
        };
      }

      const errorText = await response.text();

      // Retry tylko dla rate-limitu / przeciążenia. Inne 4xx (np. 400 zły
      // request, 401/403 auth) nie naprawią się czekaniem - rzucamy od razu.
      if (response.status === 503 || response.status === 429) {
        lastError = new Error(`Gemini ${response.status}: ${errorText}`);
        if (attempt < MAX_RETRIES - 1) {
          const czekaj = RETRY_DELAYS_MS[attempt];
          console.log(
            `[gemini] retry ${attempt + 2}/${MAX_RETRIES} po ${czekaj}ms (${response.status})`,
          );
          await new Promise((r) => setTimeout(r, czekaj));
          continue;
        }
      }

      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    } catch (e) {
      if (jestBladSieciowy(e.message) && attempt < MAX_RETRIES - 1) {
        lastError = e;
        const czekaj = RETRY_DELAYS_MS[attempt];
        console.log(
          `[gemini] network retry ${attempt + 2}/${MAX_RETRIES} po ${czekaj}ms (${e.message})`,
        );
        await new Promise((r) => setTimeout(r, czekaj));
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error('Gemini: max retries exceeded');
}

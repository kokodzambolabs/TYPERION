// Wywołanie Claude przez REST API (bez SDK - czysty fetch).
// Zwraca tekst odpowiedzi i statystyki tokenów do logu kosztu.
//
// Opcja `withThinking`: adaptive thinking (Opus 4.7+).
// Model sam decyduje ile myslec; tokeny thinking wliczaja sie do
// output_tokens (i do kosztu). Bloki 'thinking' pomijamy - bierzemy
// tylko finalny 'text'.

export async function wywolajClaude(model, prompt, opcje = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Brak ANTHROPIC_API_KEY w env.');
  }

  const { withThinking = false } = opcje;

  const requestBody = {
    model,
    max_tokens: withThinking ? 64000 : 4096,
    messages: [{ role: 'user', content: prompt }],
  };

  if (withThinking) {
    // Adaptive thinking - Opus 4.7 wymaga tego formatu zamiast
    // budget_tokens (stary format zwraca 400).
    requestBody.thinking = {
      type: 'adaptive',
      display: 'omitted',
    };
    requestBody.output_config = {
      effort: 'max',
    };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Z thinking content może mieć dwa typy bloków:
  //   { type: 'thinking', thinking: '...' } - niewidoczne, pomijamy
  //   { type: 'text', text: '...' }         - to czego szukamy
  // Bez thinking jest tylko 'text' - find() i tak go złapie.
  const textBlock = (data.content || []).find((b) => b?.type === 'text');
  const text = textBlock?.text ?? '';

  return {
    text,
    tokensInput: data.usage?.input_tokens ?? 0,
    tokensOutput: data.usage?.output_tokens ?? 0,
  };
}

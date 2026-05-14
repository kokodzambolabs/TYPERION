// Wywołanie Claude przez REST API (bez SDK - czysty fetch).
// Zwraca tekst odpowiedzi i statystyki tokenów do logu kosztu.
//
// Opcja `withThinking`: adaptive thinking (Opus 4.7+).
// Model sam decyduje ile myslec; tokeny thinking wliczaja sie do
// output_tokens (i do kosztu). Bloki 'thinking' pomijamy - bierzemy
// tylko finalny 'text'.
//
// Z withThinking dolaczamy server-side web_search tool. Claude ma cutoff
// styczeń 2026, wiec bez tego nie wie nic o aktualnej formie/składach.
// Koszt: $10 / 1000 wyszukań - przy max_uses=5 i ~10 meczach to ~$0.50.
// Bloki 'tool_use' i 'tool_result' są w response.content - parser je
// pomija (filtruje tylko type === 'text').

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
    requestBody.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ];
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

  // Z thinking content może mieć kilka typów bloków:
  //   { type: 'thinking', thinking: '...' }       - niewidoczne, pomijamy
  //   { type: 'tool_use', name: 'web_search' }    - wyszukanie, pomijamy
  //   { type: 'tool_result', content: [...] }     - wynik (auto z API)
  //   { type: 'text', text: '...' }               - to czego szukamy
  // Bierzemy ostatni 'text' - finalna odpowiedź po wyszukiwaniach.
  const content = data.content || [];
  const textBlocks = content.filter((b) => b?.type === 'text');
  const text = textBlocks[textBlocks.length - 1]?.text ?? '';

  if (withThinking) {
    const toolUseCount = content.filter((b) => b?.type === 'tool_use').length;
    console.log(
      `[claude opus deep] tool_use calls: ${toolUseCount}, input=${data.usage?.input_tokens ?? 0}, output=${data.usage?.output_tokens ?? 0}`,
    );
  }

  return {
    text,
    tokensInput: data.usage?.input_tokens ?? 0,
    tokensOutput: data.usage?.output_tokens ?? 0,
  };
}

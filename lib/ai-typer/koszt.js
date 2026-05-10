// Kalkulacja kosztu wywołania modelu na podstawie tokenów input/output.
// Stawki wyrażone w USD za 1M tokenów (oficjalne cenniki providerów).
// Modele nieskonfigurowane zwracają 0 (zostaje w logu - można doliczyć ręcznie).

const PRICING = {
  'claude-opus-4-7':         { input: 5,   output: 25 },
  'claude-sonnet-4-6':       { input: 3,   output: 15 },
  'gemini-3.1-pro-preview':  { input: 2,   output: 12 },
  'gpt-4o':                  { input: 2.5, output: 10 },
};

export function obliczKoszt(model, tokensInput, tokensOutput) {
  const p = PRICING[model];
  if (!p) return 0;

  const inputCost = ((tokensInput || 0) / 1_000_000) * p.input;
  const outputCost = ((tokensOutput || 0) / 1_000_000) * p.output;
  return inputCost + outputCost;
}

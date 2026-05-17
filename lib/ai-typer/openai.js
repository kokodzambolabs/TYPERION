// Wywołanie OpenAI (GPT-5-mini) jako "baseline ChatGPT" - bot pyta
// model 100 razy prostym promptem (default temp =1, GPT-5-mini nie
// wspiera innych wartości), bierze dominantę całego typu (home:away).
// Tiebreaker przy remisie dominanty: mediana per pole z całej puli
// odpowiedzi.
//
// Po co 100 zapytań: bot ma wykryć oszustów kopiujących z ChatGPT.
// Dominanta z dużej próby = "co najczęściej GPT odpowie zwykłemu
// userowi z banalnym promptem". Pojedyncze losowe odchyły są zjadane.
//
// Równoległość: BATCH_SIZE=20 (5 batchy po 20 requestów). Sekwencyjnie
// 100 × ~3s = 5 min (przekracza 300s budżet Vercel). 5 batchy × ~6s =
// 30s spokojnie się mieści.
//
// Filtrowanie: response_format json_object wymusza poprawny JSON, ale
// model może i tak wrócić śmieci - każda odpowiedź przechodzi przez
// JSON.parse + walidację typu liczbowego. Nieudane są pomijane
// (zliczamy tylko poprawne).

export async function wywolajOpenAI(model, prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Brak OPENAI_API_KEY w env.');
  }

  const LICZBA_ZAPYTAN = 100;
  const BATCH_SIZE = 20;

  const wszystkieTypy = [];
  let tokensInputSuma = 0;
  let tokensOutputSuma = 0;
  let bladZalogowany = false;

  for (let i = 0; i < LICZBA_ZAPYTAN; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < LICZBA_ZAPYTAN; j++) {
      batch.push(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 2000,
            response_format: { type: 'json_object' },
          }),
        })
          .then(async (r) => {
            if (r.ok) return r.json();
            if (!bladZalogowany) {
              bladZalogowany = true;
              const errText = await r.text();
              console.error(`[openai] BŁĄD ${r.status}: ${errText}`);
            }
            return null;
          })
          .then((data) => {
            if (!data) return null;
            tokensInputSuma += data.usage?.prompt_tokens || 0;
            tokensOutputSuma += data.usage?.completion_tokens || 0;
            const txt = data.choices?.[0]?.message?.content || '';
            try {
              const p = JSON.parse(txt);
              if (typeof p.home === 'number' && typeof p.away === 'number') {
                return { home: p.home, away: p.away };
              }
            } catch (e) {}
            return null;
          })
          .catch(() => null),
      );
    }
    const wyniki = await Promise.all(batch);
    wszystkieTypy.push(...wyniki.filter(Boolean));
  }

  if (wszystkieTypy.length === 0) {
    throw new Error('GPT-5-mini: 0 poprawnych odpowiedzi ze 100 prób');
  }

  // Dominanta wyniku (cały typ "home:away").
  const licznik = {};
  for (const t of wszystkieTypy) {
    const klucz = `${t.home}:${t.away}`;
    licznik[klucz] = (licznik[klucz] || 0) + 1;
  }
  const posortowane = Object.entries(licznik).sort((a, b) => b[1] - a[1]);
  const maxCount = posortowane[0][1];
  const remisy = posortowane.filter(([, c]) => c === maxCount);

  let finalHome, finalAway;
  if (remisy.length === 1) {
    [finalHome, finalAway] = remisy[0][0].split(':').map(Number);
  } else {
    // Tiebreaker: mediana per pole ze WSZYSTKICH poprawnych typów
    // (a nie tylko tych z remisu dominanty) - daje stabilniejszy wynik.
    const homes = wszystkieTypy.map((t) => t.home).sort((a, b) => a - b);
    const aways = wszystkieTypy.map((t) => t.away).sort((a, b) => a - b);
    const mid = Math.floor(wszystkieTypy.length / 2);
    finalHome = homes[mid];
    finalAway = aways[mid];
  }

  console.log(
    `[openai] zapytań=${wszystkieTypy.length}/100, dominanta=${finalHome}:${finalAway}, rozkład=${JSON.stringify(posortowane.slice(0, 5))}`,
  );

  return {
    text: JSON.stringify({ home: finalHome, away: finalAway }),
    tokensInput: tokensInputSuma,
    tokensOutput: tokensOutputSuma,
  };
}

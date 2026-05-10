'use client';

// Przycisk "Utwórz domyślne boty" - tworzy 3 sztuki (Claude Opus / Sonnet
// / Gemini) jednym kliknięciem przez Server Action utworzBotaAI.
// Pomijamy boty, których nick już istnieje (idempotentne wywołanie).

import { useState, useTransition } from 'react';
import Button from '@/components/Button';
import { utworzBotaAI } from '@/app/akcje/ai-boty';

const DOMYSLNE_BOTY = [
  {
    nick: 'Claude Opus (AI)',
    email: 'bot1@typerion.local',
    ai_provider: 'anthropic',
    ai_model: 'claude-opus-4-7',
    ai_prompt_type: 'quick',
  },
  {
    nick: 'Claude Opus (deep) (AI)',
    email: 'bot4@typerion.local',
    ai_provider: 'anthropic',
    ai_model: 'claude-opus-4-7',
    ai_prompt_type: 'deep_research_thinking',
  },
  {
    nick: 'Claude Sonnet (AI)',
    email: 'bot2@typerion.local',
    ai_provider: 'anthropic',
    ai_model: 'claude-sonnet-4-6',
    ai_prompt_type: 'quick',
  },
  {
    nick: 'Gemini Pro (AI)',
    email: 'bot3@typerion.local',
    ai_provider: 'google',
    ai_model: 'gemini-3.1-pro-preview',
    ai_prompt_type: 'deep_research',
  },
];

export default function PrzyciskUtworzBoty({ istniejaceNicki = [] }) {
  const [pending, start] = useTransition();
  const [wynik, setWynik] = useState(null);

  const istniejace = new Set(istniejaceNicki);
  const doUtworzenia = DOMYSLNE_BOTY.filter((b) => !istniejace.has(b.nick));

  if (doUtworzenia.length === 0) {
    return (
      <span className="text-xs text-emerald-300/70">
        ✓ Wszystkie domyślne boty już istnieją.
      </span>
    );
  }

  const onClick = () => {
    setWynik(null);
    start(async () => {
      const w = [];
      for (const b of doUtworzenia) {
        const r = await utworzBotaAI(b);
        w.push({ nick: b.nick, ...r });
      }
      setWynik(w);
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={onClick} disabled={pending}>
        {pending
          ? 'Tworzę…'
          : `🤖 Utwórz domyślne boty (${doUtworzenia.length})`}
      </Button>
      {wynik && (
        <ul className="text-xs text-emerald-200/80">
          {wynik.map((w, i) => (
            <li key={i}>
              {w.ok ? '✅' : '❌'} {w.nick}
              {w.error && (
                <span className="ml-1 text-rose-300">— {w.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

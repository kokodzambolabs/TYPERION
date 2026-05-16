'use client';

// Przełącznik widoczności bota (profiles.bot_ukryty) - "Widoczny / Ukryty".
// Niezależny od PrzelacznikBota (bot_active): ukryty bot wciąż pracuje,
// po prostu zwykli userzy go nie widzą w rankingu / cudzych typach.

import { useState, useTransition } from 'react';
import { przelaczUkrycieBota } from '@/app/akcje/ai-boty';

export default function PrzelacznikWidocznosciBota({ botId, ukryty }) {
  const [pending, start] = useTransition();
  const [blad, setBlad] = useState(null);

  const onClick = () => {
    setBlad(null);
    start(async () => {
      const r = await przelaczUkrycieBota(botId, !ukryty);
      if (r?.error) setBlad(r.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title={
          ukryty
            ? 'Bot jest ukryty dla zwykłych userów (ranking, cudze typy, profile). Kliknij, by pokazać.'
            : 'Bot jest widoczny dla wszystkich. Kliknij, by ukryć przed zwykłymi userami.'
        }
        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
          ukryty
            ? 'border-amber-600/60 bg-amber-900/40 text-amber-100 hover:bg-amber-800/40'
            : 'border-emerald-700/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40'
        }`}
      >
        {pending ? '…' : ukryty ? 'Pokaż' : 'Ukryj'}
      </button>
      {blad && <span className="text-[11px] text-rose-300">{blad}</span>}
    </div>
  );
}

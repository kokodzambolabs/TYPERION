'use client';

// Mały przełącznik aktywności bota (profiles.bot_active) - przycisk
// "Włącz" / "Wyłącz" przy każdym bocie na liście w panelu /admin/boty-ai.

import { useState, useTransition } from 'react';
import { przelaczAktywnoscBota } from '@/app/akcje/ai-boty';

export default function PrzelacznikBota({ botId, aktywny }) {
  const [pending, start] = useTransition();
  const [blad, setBlad] = useState(null);

  const onClick = () => {
    setBlad(null);
    start(async () => {
      const r = await przelaczAktywnoscBota(botId, !aktywny);
      if (r?.error) setBlad(r.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
          aktywny
            ? 'border-rose-700/50 bg-rose-950/40 text-rose-100 hover:bg-rose-900/40'
            : 'border-emerald-600/50 bg-emerald-900/40 text-emerald-100 hover:bg-emerald-800/40'
        }`}
      >
        {pending ? '…' : aktywny ? 'Wyłącz' : 'Włącz'}
      </button>
      {blad && <span className="text-[11px] text-rose-300">{blad}</span>}
    </div>
  );
}

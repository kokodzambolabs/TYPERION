'use client';

// Wspólny formularz meczu - dla /admin/mecze/nowy i /admin/mecze/[id]/edycja.
// Dwa selecty (gospodarze, goście) wzajemnie się filtrują - po wybraniu drużyny
// po jednej stronie znika z listy po drugiej (CHECK w bazie i tak by zablokował,
// ale lepiej żeby user nie miał takiej opcji w UI).
// Data + godzina osobno; łączymy w timestamptz po stronie serwera (czas PL).

import { useActionState, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';

export default function FormularzMeczu({ akcja, druzyny, defaultValues = {} }) {
  const [stan, action, pending] = useActionState(akcja, null);
  const [home, setHome] = useState(
    defaultValues.home_team_id ? String(defaultValues.home_team_id) : '',
  );
  const [away, setAway] = useState(
    defaultValues.away_team_id ? String(defaultValues.away_team_id) : '',
  );

  return (
    <form action={action} className="space-y-4">
      <SelectDruzynaInline
        label="Gospodarze"
        name="home_team_id"
        druzyny={druzyny}
        value={home}
        onChange={setHome}
        excludeId={away}
      />
      <SelectDruzynaInline
        label="Goście"
        name="away_team_id"
        druzyny={druzyny}
        value={away}
        onChange={setAway}
        excludeId={home}
      />

      <div className="grid grid-cols-2 gap-3">
        <Pole
          label="Data"
          name="kickoff_date"
          type="date"
          defaultValue={defaultValues.kickoff_date}
          required
        />
        <Pole
          label="Godzina (czas polski)"
          name="kickoff_time"
          type="time"
          defaultValue={defaultValues.kickoff_time}
          required
        />
      </div>

      {stan?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {stan.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisuję…' : 'Zapisz mecz'}
        </Button>
        <Link href="/admin/mecze" className="text-sm text-emerald-300 hover:text-emerald-200">
          Anuluj
        </Link>
      </div>
    </form>
  );
}

function SelectDruzynaInline({ label, name, druzyny, value, onChange, excludeId }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      >
        <option value="">Wybierz drużynę…</option>
        {druzyny
          .filter((d) => String(d.id) !== excludeId)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function Pole({ label, name, type = 'text', defaultValue, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-emerald-100">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      />
    </label>
  );
}

'use client';

// Drugi formularz na stronie edycji pytania - poprawna odpowiedź zależy od typu:
// - team    -> select drużyny
// - boolean -> radio Tak/Nie
// - text/number -> pole tekstowe (referencja, punkty wpisuje admin pod /rozlicz)
// Dla team i boolean dodatkowy przycisk "Rozlicz automatycznie".

import { useActionState, useTransition } from 'react';
import Button from '@/components/Button';

export default function FormularzPoprawnejOdp({
  pytanie,
  druzyny,
  akcjaZapisz,
  akcjaRozlicz,
}) {
  const [stan, action, pending] = useActionState(akcjaZapisz, null);
  const [rozliczanie, startRozliczanie] = useTransition();

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="question_type" value={pytanie.question_type} />

        {pytanie.question_type === 'team' && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-emerald-100">
              Poprawna drużyna
            </span>
            <select
              name="correct_team_id"
              defaultValue={pytanie.correct_team_id ?? ''}
              required
              className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="">Wybierz…</option>
              {(pytanie.team_group
                ? druzyny.filter(
                    (d) => d.group_in_tournament === pytanie.team_group,
                  )
                : druzyny
              ).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {pytanie.question_type === 'boolean' && (
          <div>
            <span className="mb-1 block text-sm font-medium text-emerald-100">
              Poprawna odpowiedź
            </span>
            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-emerald-100 has-[input:checked]:border-emerald-400 has-[input:checked]:bg-emerald-900/40">
                <input
                  type="radio"
                  name="correct_boolean"
                  value="true"
                  defaultChecked={pytanie.correct_boolean === true}
                  required
                  className="accent-emerald-500"
                />
                Tak
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-emerald-100 has-[input:checked]:border-emerald-400 has-[input:checked]:bg-emerald-900/40">
                <input
                  type="radio"
                  name="correct_boolean"
                  value="false"
                  defaultChecked={pytanie.correct_boolean === false}
                  required
                  className="accent-emerald-500"
                />
                Nie
              </label>
            </div>
          </div>
        )}

        {(pytanie.question_type === 'text' || pytanie.question_type === 'number') && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-emerald-100">
              Poprawna odpowiedź (referencja - punkty wpisuje admin ręcznie pod „Rozlicz”)
            </span>
            <input
              name="correct_answer"
              defaultValue={pytanie.correct_answer ?? ''}
              required
              type="text"
              placeholder={
                pytanie.question_type === 'number'
                  ? 'np. 12'
                  : 'np. Robert Lewandowski'
              }
              className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 placeholder-emerald-300/40 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
          </label>
        )}

        {stan?.error && (
          <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {stan.error}
          </p>
        )}
        {stan?.ok && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            {stan.ok}
          </p>
        )}

        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Zapisuję…' : 'Zapisz poprawną odpowiedź'}
        </Button>
      </form>

      {(pytanie.question_type === 'team' || pytanie.question_type === 'boolean') && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4">
          <p className="mb-3 text-sm text-amber-100">
            Po zapisaniu poprawnej odpowiedzi możesz rozliczyć wszystkie odpowiedzi
            userów automatycznie - punkty zostaną przeliczone i pytanie oznaczone
            jako rozliczone.
          </p>
          <button
            type="button"
            disabled={rozliczanie}
            onClick={() => {
              if (
                !confirm(
                  'Rozliczyć wszystkie odpowiedzi automatycznie? Punkty zostaną przeliczone i pytanie zamknięte.',
                )
              )
                return;
              startRozliczanie(async () => {
                const res = await akcjaRozlicz();
                if (res?.error) alert(res.error);
                else if (res?.ok) alert(res.ok);
              });
            }}
            className="rounded-md border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
          >
            {rozliczanie ? 'Rozliczam…' : 'Rozlicz automatycznie'}
          </button>
        </div>
      )}
    </div>
  );
}

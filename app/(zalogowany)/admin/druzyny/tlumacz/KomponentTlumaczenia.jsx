'use client';

// Lista checkboxów reprezentacji do przetłumaczenia + sekcja informacyjna
// z klubami (bez akcji). Po kliknięciu "Zastosuj" wywołujemy server action
// zastosujTlumaczenia z wybranymi wpisami.
//
// Po sukcesie bez błędów: redirect na /admin/druzyny?przetlumaczono=X.
// Jeśli były errors - zostajemy na stronie i pokazujemy je adminowi.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import { zastosujTlumaczenia } from '@/app/akcje/druzyny';

export default function KomponentTlumaczenia({ reprezentacje, kluby }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [zaznaczone, setZaznaczone] = useState(
    () => new Set(reprezentacje.map((r) => r.id)),
  );
  const [komunikat, setKomunikat] = useState(null);

  const toggle = (id) => {
    setZaznaczone((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const zaznaczWszystkie = () => {
    setZaznaczone(new Set(reprezentacje.map((r) => r.id)));
  };

  const odznaczWszystkie = () => {
    setZaznaczone(new Set());
  };

  const submit = () => {
    setKomunikat(null);
    const lista = reprezentacje
      .filter((r) => zaznaczone.has(r.id))
      .map((r) => ({ teamId: r.id, newName: r.proposedName }));

    if (lista.length === 0) {
      setKomunikat({ error: 'Zaznacz przynajmniej jedną reprezentację.' });
      return;
    }

    start(async () => {
      const res = await zastosujTlumaczenia(lista);
      if (res?.error) {
        setKomunikat({ error: res.error });
        return;
      }
      if (res?.errors && res.errors.length > 0) {
        // Częściowy sukces - pokażemy szczegóły i zostaniemy na stronie.
        setKomunikat({
          translated: res.translated,
          skipped: res.skipped,
          errors: res.errors,
        });
        router.refresh();
        return;
      }
      router.push(`/admin/druzyny?przetlumaczono=${res.translated}`);
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={submit}
          disabled={pending || reprezentacje.length === 0 || zaznaczone.size === 0}
        >
          {pending
            ? 'Zapisuję…'
            : `💾 Zastosuj zaznaczone tłumaczenia (${zaznaczone.size})`}
        </Button>
        {reprezentacje.length > 0 && (
          <>
            <Button variant="ghost" onClick={zaznaczWszystkie} disabled={pending}>
              Zaznacz wszystkie
            </Button>
            <Button variant="ghost" onClick={odznaczWszystkie} disabled={pending}>
              Odznacz wszystkie
            </Button>
          </>
        )}
      </div>

      {komunikat?.error && (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {komunikat.error}
        </p>
      )}
      {komunikat?.errors && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-3 text-sm text-amber-100">
          <p className="font-semibold">
            Przetłumaczono: {komunikat.translated} · pominięto: {komunikat.skipped}
          </p>
          <ul className="ml-5 list-disc space-y-1">
            {komunikat.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-emerald-100">
          Reprezentacje do przetłumaczenia{' '}
          <span className="text-sm font-normal text-emerald-300/70">
            ({reprezentacje.length})
          </span>
        </h2>
        {reprezentacje.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
            Brak reprezentacji wymagających tłumaczenia. ✅
          </p>
        ) : (
          <ul className="space-y-2">
            {reprezentacje.map((r) => {
              const checked = zaznaczone.has(r.id);
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-emerald-900/40 bg-emerald-900/20"
                >
                  <label
                    htmlFor={`tlum-${r.id}`}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3"
                  >
                    <input
                      id={`tlum-${r.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 cursor-pointer accent-emerald-500"
                    />
                    <span className="flex-1 text-emerald-50">
                      <span className="font-semibold">{r.currentName}</span>
                      <span className="mx-2 text-emerald-400">→</span>
                      <span className="text-emerald-200">{r.proposedName}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-emerald-100">
          Kluby pomijane{' '}
          <span className="text-sm font-normal text-emerald-300/70">
            (nie ma w słowniku) ({kluby.length})
          </span>
        </h2>
        {kluby.length === 0 ? (
          <p className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-200/60">
            Brak innych drużyn.
          </p>
        ) : (
          <ul className="space-y-1">
            {kluby.map((k) => (
              <li
                key={k.id}
                className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-4 py-2 text-sm text-emerald-100/80"
              >
                {k.name}{' '}
                <span className="text-emerald-300/50">(zostaje bez zmian)</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

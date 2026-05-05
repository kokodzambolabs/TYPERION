// Lista drużyn (alfabetycznie po name) z akcjami Edytuj/Usuń.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { przetlumaczNaPolski } from '@/lib/translateTeams';
import { formatGrupa } from '@/lib/format';
import Button from '@/components/Button';
import PrzyciskUsun from '@/components/PrzyciskUsun';
import PrzyciskPrzypiszGrupy from '@/components/PrzyciskPrzypiszGrupy';
import { usunDruzyne } from '@/app/akcje/druzyny';

export default async function DruzynyPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const przetlumaczono = sp?.przetlumaczono ? Number(sp.przetlumaczono) : null;

  const supabase = await createClient();
  const { data: druzyny, error } = await supabase
    .from('teams')
    .select('id, name, group_in_tournament')
    .order('name', { ascending: true });

  // Czy są drużyny których nazwa to wartość angielska ze słownika?
  // Jeśli tak - pokazujemy guzik linkujący do strony tłumaczeń.
  const wymagaTlumaczenia = (druzyny || []).some((d) => przetlumaczNaPolski(d.name));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-emerald-50">Drużyny</h1>
        <div className="flex flex-wrap items-center gap-2">
          {wymagaTlumaczenia && (
            <Link href="/admin/druzyny/tlumacz">
              <Button variant="secondary">🇵🇱 Tłumacz nazwy reprezentacji</Button>
            </Link>
          )}
          <Link href="/admin/druzyny/automapowanie">
            <Button variant="secondary">🤖 Auto-mapuj</Button>
          </Link>
          <Link href="/admin/druzyny/mapowanie">
            <Button variant="secondary">🔗 Mapuj drużyny do API</Button>
          </Link>
          <PrzyciskPrzypiszGrupy />
          <Link href="/admin/druzyny/nowa">
            <Button variant="primary">+ Dodaj drużynę</Button>
          </Link>
        </div>
      </div>

      {przetlumaczono != null && przetlumaczono > 0 && (
        <p className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          ✅ Przetłumaczono {przetlumaczono} drużyn.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          Błąd ładowania drużyn: {error.message}
        </p>
      )}

      {!druzyny || druzyny.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
          Brak drużyn. Dodaj pierwszą drużynę.
        </div>
      ) : (
        <ul className="space-y-2">
          {druzyny.map((d) => {
            const grupaEtykieta = formatGrupa(d.group_in_tournament);
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-emerald-50">{d.name}</span>
                  {grupaEtykieta && (
                    <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                      {grupaEtykieta}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/druzyny/${d.id}/edycja`}
                    className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                  >
                    Edytuj
                  </Link>
                  <PrzyciskUsun
                    akcja={usunDruzyne.bind(null, d.id)}
                    etykieta={`Usunąć drużynę "${d.name}"?`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

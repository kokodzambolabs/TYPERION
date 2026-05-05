// Lista kodów zaproszeń + historia użyć.
// Po wygenerowaniu nowego kodu admin trafia tu z ?nowy=KOD - pokazujemy
// banner z kodem i przyciskiem do skopiowania.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/Button';
import {
  dezaktywujKod,
  aktywujKod,
  usunKod,
} from '@/app/akcje/zaproszenia';
import PrzyciskUsun from '@/components/PrzyciskUsun';
import KopiujKod from './KopiujKod';
import PrzelacznikAktywnosci from './PrzelacznikAktywnosci';

export default async function ZaproszeniaPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const nowyKod = typeof sp.nowy === 'string' ? sp.nowy : null;

  const supabase = await createClient();

  const [{ data: kody }, { data: historia }] = await Promise.all([
    supabase
      .from('invitation_codes')
      .select(
        'id, code, description, max_uses, uses_count, is_active, expires_at, created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('invitation_code_uses')
      .select('id, used_at, code_id, user_id')
      .order('used_at', { ascending: false })
      .limit(100),
  ]);

  // Dociągamy nicki userów + kody do historii w osobnych zapytaniach
  // (FK w invitation_code_uses ma ON DELETE SET NULL - mogą być NULLe).
  const userIds = [...new Set((historia || []).map((h) => h.user_id).filter(Boolean))];
  const codeIds = [...new Set((historia || []).map((h) => h.code_id).filter(Boolean))];

  const [{ data: profile }, { data: kodyDoHistorii }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, nick').in('id', userIds)
      : Promise.resolve({ data: [] }),
    codeIds.length > 0
      ? supabase.from('invitation_codes').select('id, code').in('id', codeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nickPoId = new Map((profile || []).map((p) => [p.id, p.nick]));
  const kodPoId = new Map((kodyDoHistorii || []).map((k) => [k.id, k.code]));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">Kody zaproszeń</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Bez kodu nikt nie założy konta. Wygeneruj kod, daj znajomemu, on go
            wpisze przy rejestracji.
          </p>
        </div>
        <Link href="/admin/zaproszenia/nowy">
          <Button variant="primary">+ Wygeneruj nowy kod</Button>
        </Link>
      </div>

      {nowyKod && (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-4 text-emerald-100">
          <p className="mb-2 text-sm">
            ✅ Nowy kod wygenerowany. Skopiuj go i przekaż znajomemu —
            <strong className="font-semibold"> nie pokażemy go drugi raz</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-emerald-500/40 bg-emerald-900/40 px-3 py-2 font-mono text-lg tracking-wider text-emerald-50">
              {nowyKod}
            </code>
            <KopiujKod kod={nowyKod} />
          </div>
        </div>
      )}

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold text-emerald-50">Aktualne kody</h2>
        {!kody || kody.length === 0 ? (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-12 text-center text-emerald-200/70">
            Brak kodów. Wygeneruj pierwszy kod.
          </div>
        ) : (
          <ul className="space-y-2">
            {kody.map((k) => {
              const wygasl =
                k.expires_at && new Date(k.expires_at) <= new Date();
              const wyczerpany = k.uses_count >= k.max_uses;
              const status = !k.is_active
                ? { label: 'Dezaktywowany', kolor: 'text-red-300' }
                : wygasl
                  ? { label: 'Wygasł', kolor: 'text-yellow-300' }
                  : wyczerpany
                    ? { label: 'Wyczerpany', kolor: 'text-yellow-300' }
                    : { label: 'Aktywny', kolor: 'text-emerald-300' };

              return (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-md border border-emerald-800/60 bg-emerald-950/50 px-2 py-1 font-mono text-sm text-emerald-50">
                        {k.code}
                      </code>
                      <KopiujKod kod={k.code} />
                      <span className={`text-xs font-semibold ${status.kolor}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-sm text-emerald-200/80">
                      {k.description || <em>(bez opisu)</em>}
                    </div>
                    <div className="text-xs text-emerald-200/60">
                      Użycia: {k.uses_count}/{k.max_uses}
                      {k.expires_at && (
                        <>
                          {' '}
                          · Wygasa: {formatujDate(k.expires_at)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PrzelacznikAktywnosci
                      id={k.id}
                      aktywny={k.is_active}
                      akcjaAktywuj={aktywujKod.bind(null, k.id)}
                      akcjaDezaktywuj={dezaktywujKod.bind(null, k.id)}
                    />
                    <PrzyciskUsun
                      akcja={usunKod.bind(null, k.id)}
                      etykieta={`Usunąć kod ${k.code}?`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-emerald-50">Historia użyć</h2>
        {!historia || historia.length === 0 ? (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-6 py-8 text-center text-emerald-200/70">
            Jeszcze nikt nie użył żadnego kodu.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-emerald-900/40 bg-emerald-900/20">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-900/40 text-emerald-200/80">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Kod</th>
                  <th className="px-4 py-2 text-left font-semibold">Nick</th>
                  <th className="px-4 py-2 text-left font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {historia.map((h) => (
                  <tr
                    key={h.id}
                    className="border-t border-emerald-900/40 text-emerald-100"
                  >
                    <td className="px-4 py-2 font-mono">
                      {kodPoId.get(h.code_id) ?? <em>(usunięty)</em>}
                    </td>
                    <td className="px-4 py-2">
                      {nickPoId.get(h.user_id) ?? <em>(usunięty user)</em>}
                    </td>
                    <td className="px-4 py-2 text-emerald-200/80">
                      {formatujDate(h.used_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function formatujDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

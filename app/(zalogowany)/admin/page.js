// Panel admina - dashboard z czterema kafelkami i statystykami u góry.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createClient();

  // Cztery liczby na statystyki - count(head: true) nie pobiera wierszy.
  const [druzyny, mecze, pytania, userzy] = await Promise.all([
    supabase.from('teams').select('id', { count: 'exact', head: true }),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    supabase.from('bonus_questions').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-emerald-50">Panel admina</h1>
      <p className="mb-8 text-emerald-200/70">
        Zarządzaj drużynami, meczami, pytaniami bonusowymi i ustawieniami turnieju.
      </p>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Statystyka etykieta="Drużyny" liczba={druzyny.count ?? 0} />
        <Statystyka etykieta="Mecze" liczba={mecze.count ?? 0} />
        <Statystyka etykieta="Pytania bonusowe" liczba={pytania.count ?? 0} />
        <Statystyka etykieta="Userzy" liczba={userzy.count ?? 0} />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Kafelek
          href="/admin/druzyny"
          tytul="Drużyny"
          opis="Dodawaj, edytuj i usuwaj drużyny biorące udział w turnieju."
        />
        <Kafelek
          href="/admin/mecze"
          tytul="Mecze"
          opis="Twórz harmonogram meczów. Po starcie meczu edycja jest blokowana."
        />
        <Kafelek
          href="/admin/bonusy"
          tytul="Pytania bonusowe"
          opis="Pytania przed turniejem (mistrz, król strzelców itp.). Rozliczanie automatyczne lub ręczne."
        />
        <Kafelek
          href="/admin/ustawienia"
          tytul="Ustawienia turnieju"
          opis="Nazwa turnieju, data zamknięcia bonusów, data startu."
        />
        <Kafelek
          href="/admin/import"
          tytul="📥 Import meczów"
          opis="Pobierz harmonogram z Football-Data.org. Wymaga zmapowanych drużyn."
        />
      </div>
    </main>
  );
}

function Statystyka({ etykieta, liczba }) {
  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-4 py-3">
      <div className="text-2xl font-bold text-emerald-50">{liczba}</div>
      <div className="text-xs text-emerald-200/70">{etykieta}</div>
    </div>
  );
}

function Kafelek({ href, tytul, opis }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-emerald-900/40 bg-emerald-900/20 p-6 transition hover:border-emerald-500/60 hover:bg-emerald-800/30"
    >
      <h2 className="mb-2 text-xl font-bold text-emerald-50 group-hover:text-emerald-200">
        {tytul}
      </h2>
      <p className="text-sm text-emerald-200/70">{opis}</p>
    </Link>
  );
}

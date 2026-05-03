// Layout dla stron wymagających zalogowania.
// Druga linia obrony - proxy.js sprawdza sesję na poziomie URL,
// a tu jeszcze raz po stronie serwera, zanim cokolwiek wyrenderujemy.
// To zalecany "Data Access Layer" pattern z dokumentacji Next.js 16.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { wyloguj } from '@/app/akcje/auth';
import Button from '@/components/Button';
import BannerBonusow from '@/components/BannerBonusow';

export default async function ZalogowanyLayout({ children }) {
  const supabase = await createClient();

  // getUser() pyta serwer Supabase - bezpieczne, nie polegamy na ciasteczku.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/logowanie');
  }

  // Pobieramy nick i flagę admina, żeby wiedzieć czy pokazać link "Admin".
  const { data: profil } = await supabase
    .from('profiles')
    .select('nick, is_admin')
    .eq('id', user.id)
    .single();

  // Dane do BannerBonusow - pokazujemy tylko jeśli bonusy otwarte
  // i user ma niewypełnione pytania.
  const { data: settings } = await supabase
    .from('tournament_settings')
    .select('bonuses_close_at')
    .eq('id', 1)
    .single();

  let brakujace = 0;
  const closeAt = settings?.bonuses_close_at;
  if (closeAt && new Date(closeAt).getTime() > new Date().getTime()) {
    const [{ count: liczbaPytan }, { data: odpowiedzi }] = await Promise.all([
      supabase
        .from('bonus_questions')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('bonus_answers')
        .select('question_id')
        .eq('user_id', user.id),
    ]);
    brakujace = Math.max(0, (liczbaPytan ?? 0) - (odpowiedzi?.length ?? 0));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Navbar nick={profil?.nick} isAdmin={!!profil?.is_admin} />
      <BannerBonusow closeAt={closeAt} brakujace={brakujace} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function Navbar({ nick, isAdmin }) {
  return (
    <header className="border-b border-emerald-900/50 bg-emerald-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/mecze" className="font-bold text-emerald-100">
          ⚽ Typer
        </Link>
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <NavLink href="/mecze">Mecze</NavLink>
          <NavLink href="/bonusy">Bonusy</NavLink>
          <NavLink href="/ranking">Ranking</NavLink>
          <NavLink href="/profil">Profil{nick ? ` (${nick})` : ''}</NavLink>
          {isAdmin && <NavLink href="/admin">Admin</NavLink>}
        </div>
        <form action={wyloguj}>
          <Button type="submit" variant="ghost">
            Wyloguj się
          </Button>
        </form>
      </nav>
    </header>
  );
}

function NavLink({ href, children }) {
  return (
    <Link
      href={href}
      className="text-emerald-200/80 transition hover:text-emerald-100"
    >
      {children}
    </Link>
  );
}

// Strona profilu - pokazuje email z auth.users i nick z profiles.
// Wylogowanie idzie przez form action -> Server Action.

import { createClient } from '@/lib/supabase/server';
import { wyloguj } from '@/app/akcje/auth';
import Button from '@/components/Button';

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = await supabase
    .from('profiles')
    .select('nick, is_admin')
    .eq('id', user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Profil</h1>

      <dl className="mb-8 divide-y divide-emerald-900/40 rounded-xl border border-emerald-900/40 bg-emerald-900/20">
        <Wiersz label="E-mail" value={user.email} />
        <Wiersz label="Nick" value={profil?.nick ?? '—'} />
        {profil?.is_admin && <Wiersz label="Rola" value="Administrator" />}
      </dl>

      <form action={wyloguj}>
        <Button type="submit" variant="secondary">
          Wyloguj się
        </Button>
      </form>
    </main>
  );
}

function Wiersz({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-emerald-200/70">{label}</dt>
      <dd className="font-medium text-emerald-50">{value}</dd>
    </div>
  );
}

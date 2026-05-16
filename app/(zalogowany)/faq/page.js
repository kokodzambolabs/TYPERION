// Strona FAQ / Regulamin - dostępna dla zalogowanych.
// Treść siedzi w komponencie <TrescRegulaminu />, tym samym którego
// używa modal pierwszego logowania - jedno miejsce na zmianę treści.
// Auth weryfikowany w (zalogowany)/layout.js - tu redirect dla pewności.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TrescRegulaminu from '@/components/TrescRegulaminu';

export const metadata = {
  title: 'FAQ / Regulamin',
};

export default async function FaqPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/logowanie');

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-emerald-50">FAQ / Regulamin</h1>
      <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/60 p-6 sm:p-8">
        <TrescRegulaminu />
      </div>
    </main>
  );
}

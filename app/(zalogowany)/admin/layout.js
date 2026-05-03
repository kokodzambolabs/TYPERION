// Dodatkowy strażnik dla /admin - sprawdza is_admin = true.
// Zwykły zalogowany trafia tu z /mecze (np. ręcznie wpisując URL) - odbijamy go.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profil?.is_admin) {
    redirect('/mecze');
  }

  return <>{children}</>;
}

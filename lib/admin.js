// Helper sprawdzający uprawnienia admina przed wykonaniem Server Action.
// Defense in depth - RLS i tak by zablokował operację, ale my chcemy ładny
// komunikat błędu zamiast surowego wyjątku z bazy.

import { createClient } from './supabase/server';

export async function sprawdzAdmina() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  const { data: profil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profil?.is_admin) {
    return { error: 'Brak uprawnień admina.' };
  }
  return { supabase, user };
}

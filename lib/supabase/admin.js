// Klient Supabase z kluczem service_role - OMIJA RLS.
// Używać WYŁĄCZNIE w kodzie serwerowym z własną autoryzacją:
//   - cron API Route (po sprawdzeniu CRON_SECRET),
//   - ewentualne taski wywoływane z Server Actions po walidacji is_admin.
//
// SUPABASE_SERVICE_ROLE_KEY nie ma prefiksu NEXT_PUBLIC_ - nie może
// trafić do bundla klienta. Jeśli ten plik zostanie zaimportowany
// w Client Component, Next.js wywali błąd buildu.

import { createClient } from '@supabase/supabase-js';

let cached = null;

export function utworzKlientaServiceRole() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env.',
    );
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

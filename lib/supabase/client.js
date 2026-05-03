// Klient Supabase dla Client Components (przeglądarka).
// Używamy go tylko tam, gdzie naprawdę musimy odpalić zapytanie z poziomu
// komponentu klienckiego - większość rzeczy robimy w Server Components/Actions.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

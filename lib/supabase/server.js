// Klient Supabase dla Server Components, Server Actions i Route Handlers.
// W Next.js 16 funkcja cookies() jest ASYNCHRONICZNA - dlatego cały createClient
// też jest async, a w środku robimy `await cookies()`.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // setAll może być wywołane w Server Component, gdzie ustawianie cookies
          // jest niemożliwe - łapiemy błąd, sesja i tak zostanie odświeżona
          // przez proxy.js przy następnym żądaniu.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Wywołane z Server Componentu - można zignorować.
          }
        },
      },
    }
  );
}

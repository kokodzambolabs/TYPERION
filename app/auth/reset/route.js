// Route Handler dla linku z maila "Reset hasła".
// URL: /auth/reset?code=XYZ
// Wymieniamy `code` na sesję (PKCE) i zapisujemy ciasteczka, potem
// przekierowujemy na /nowe-haslo gdzie user wpisuje nowe hasło.
// Po błędzie - /logowanie?error=invalid_link.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/logowanie?error=invalid_link`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/logowanie?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}/nowe-haslo`);
}

// Route Handler dla linka aktywacyjnego z maila Supabase.
// URL: /auth/callback?code=XYZ
// Wymieniamy `code` na sesję i zapisujemy ciasteczka, potem przekierowujemy
// na /mecze. Plik MUSI być poza grupą (auth) - chcemy URL /auth/callback,
// a nie /callback.

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
          // W Route Handlerze ustawianie ciasteczek jest dozwolone,
          // więc tu tworzy się prawdziwa sesja, której potem używają
          // wszystkie chronione strony.
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/logowanie?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}/mecze`);
}

// Klient Supabase do użycia w głównym proxy.js (Next.js 16).
// Jego zadanie: na każde żądanie odświeżyć access token (jeśli wygasł)
// i zapisać nowe ciasteczka w odpowiedzi, żeby Server Components dostały
// świeżą sesję.
//
// Dodatkowo robimy tu logikę przekierowań:
//  - niezalogowany na chronionej stronie -> /logowanie
//  - zalogowany na stronie auth lub "/" -> /mecze

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Strony dostępne tylko dla niezalogowanych (zalogowany dostaje redirect na /mecze)
const tylkoNiezalogowani = [
  '/',
  '/logowanie',
  '/rejestracja',
  '/weryfikacja',
  '/zapomnialem-hasla',
];

// Prefiksy chronionych ścieżek - tylko dla zalogowanych
const tylkoZalogowani = [
  '/mecze',
  '/ranking',
  '/profil',
  '/admin',
  '/nowe-haslo',
];

// Trasy serwerowe Supabase (callbacki linków z maili) - przepuszczamy
// niezależnie od stanu sesji. Inaczej proxy by przekierowało:
//  - niezalogowanego na /logowanie zanim callback zdąży utworzyć sesję,
//  - zalogowanego (np. po wcześniejszym kliknięciu) na /mecze.
const sciezkiAuth = ['/auth/'];

export async function aktualizujSesje(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Ważne: kopiujemy ciasteczka i do request, i do response.
          // Inaczej Server Components na tej samej trasie zobaczą starą sesję.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() odpytuje serwer Supabase i automatycznie odświeża token,
  // jeśli wygasł. To jest miejsce, gdzie sesja "żyje".
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sciezka = request.nextUrl.pathname;

  // Trasy /auth/* (np. callback Supabase) lecą bez żadnych redirectów.
  if (sciezkiAuth.some((prefix) => sciezka.startsWith(prefix))) {
    return response;
  }

  const jestChroniona = tylkoZalogowani.some(
    (prefix) => sciezka === prefix || sciezka.startsWith(prefix + '/')
  );
  const jestPubliczna = tylkoNiezalogowani.includes(sciezka);

  // Niezalogowany próbuje wejść na chronioną stronę -> /logowanie
  if (!user && jestChroniona) {
    const url = request.nextUrl.clone();
    url.pathname = '/logowanie';
    return NextResponse.redirect(url);
  }

  // Zalogowany jest na stronie powitalnej/logowania/rejestracji -> /mecze
  if (user && jestPubliczna) {
    const url = request.nextUrl.clone();
    url.pathname = '/mecze';
    return NextResponse.redirect(url);
  }

  return response;
}

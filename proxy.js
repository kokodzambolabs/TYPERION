// Proxy w Next.js 16 (dawniej middleware.js).
// Plik MUSI nazywać się dokładnie `proxy.js` i leżeć w głównym folderze projektu.
// Uruchamia się przed każdym żądaniem - tu odświeżamy sesję Supabase
// i pilnujemy, kto na jaką stronę może wejść.

import { aktualizujSesje } from '@/lib/supabase/proxy';

export async function proxy(request) {
  return await aktualizujSesje(request);
}

export const config = {
  matcher: [
    // Pomijamy zasoby Next.js, API, ikony, obrazki i inne pliki statyczne.
    // Reszta tras (czyli wszystkie nasze strony) przechodzi przez proxy.
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

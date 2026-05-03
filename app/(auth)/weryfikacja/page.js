// Strona "Sprawdź skrzynkę" - pokazujemy ją po rejestracji.
// Supabase wysłał już maila z linkiem aktywacyjnym, user ma w niego
// kliknąć. Tu nie ma żadnej weryfikacji kodu - tylko informacja
// i mały formularz do ponownego wysłania linku.

import Link from 'next/link';
import FormularzPonownegoLinku from './FormularzPonownegoLinku';

export default async function WeryfikacjaPage({ searchParams }) {
  const params = await searchParams;
  const email = typeof params?.email === 'string' ? params.email : '';

  return (
    <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/30 p-8 shadow-xl backdrop-blur">
      <div className="mb-4 text-center text-6xl" aria-hidden="true">
        ✉️
      </div>

      <h1 className="mb-3 text-center text-2xl font-bold text-emerald-50">
        Sprawdź skrzynkę pocztową
      </h1>

      <p className="mb-3 text-center text-sm text-emerald-100">
        Wysłaliśmy link aktywacyjny na adres{' '}
        {email ? (
          <span className="font-semibold text-emerald-300">{email}</span>
        ) : (
          <span className="font-semibold text-emerald-300">Twojego maila</span>
        )}
        . Kliknij w niego, aby dokończyć rejestrację.
      </p>

      <p className="mb-6 text-center text-xs text-emerald-200/60">
        Sprawdź też folder spam, jeśli wiadomości nie widać w skrzynce.
      </p>

      <div className="mb-6 border-t border-emerald-800/50 pt-6">
        <p className="mb-3 text-sm font-medium text-emerald-100">
          Nie dostałeś maila?
        </p>
        <FormularzPonownegoLinku email={email} />
      </div>

      <p className="text-center text-sm text-emerald-200/70">
        <Link
          href="/logowanie"
          className="font-semibold text-emerald-300 hover:text-emerald-200"
        >
          Powrót do logowania
        </Link>
      </p>
    </div>
  );
}

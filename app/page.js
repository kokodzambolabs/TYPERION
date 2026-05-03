// Strona powitalna. Zalogowani i tak nie zobaczą - proxy.js przekierowuje
// ich na /mecze.

import Link from 'next/link';
import Button from '@/components/Button';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-xl">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-emerald-50 sm:text-5xl">
          Typer Piłkarski
        </h1>
        <p className="mb-8 text-lg text-emerald-200/80">
          Typuj wyniki meczów, zbieraj punkty, walcz o pierwsze miejsce w rankingu.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/logowanie">
            <Button variant="primary" className="min-w-[160px]">
              Zaloguj się
            </Button>
          </Link>
          <Link href="/rejestracja">
            <Button variant="secondary" className="min-w-[160px]">
              Załóż konto
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

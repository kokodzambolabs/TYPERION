// Banner odliczający czas do zamknięcia bonusów.
// Renderowany w (zalogowany)/layout.js. Pokazuje się tylko jeśli:
//   - bonuses_close_at > now(),
//   - user ma jakieś niewypełnione pytania bonusowe.
// Fakt "user ma niewypełnione pytania" obliczamy w layoucie (server),
// tu dostajemy gotowe liczby.

import Link from 'next/link';

export default function BannerBonusow({ closeAt, brakujace }) {
  if (!closeAt) return null;
  const ms = new Date(closeAt).getTime() - new Date().getTime();
  if (ms <= 0) return null;
  if (!brakujace || brakujace <= 0) return null;

  const dni = Math.floor(ms / (24 * 60 * 60 * 1000));
  const godziny = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm text-amber-100">
        <span>
          📋 Wypełnij bonusy! Pozostało: {dni} {dni === 1 ? 'dzień' : 'dni'}{' '}
          {godziny} {godziny === 1 ? 'godzinę' : 'godzin'}
          {brakujace > 0 && (
            <span className="ml-2 text-amber-200/80">
              ({brakujace} {brakujace === 1 ? 'pytanie' : 'pytań'} do uzupełnienia)
            </span>
          )}
        </span>
        <Link
          href="/bonusy"
          className="rounded-md border border-amber-400/50 bg-amber-500/20 px-3 py-1 font-semibold text-amber-50 transition hover:bg-amber-500/30"
        >
          Wypełnij →
        </Link>
      </div>
    </div>
  );
}

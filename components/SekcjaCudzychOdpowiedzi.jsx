'use client';

// Panel z listą cudzych odpowiedzi na pojedyncze pytanie bonusowe -
// wzorzec 1:1 z SekcjaCudzychTypow (cudze typy meczowe).
// Stan (otwarte / lazy fetch) jest po stronie rodzica (ListaBonusowOdczyt),
// żeby przycisk-toggler siedział inline w nagłówku karty pytania, a panel
// rozwijany leciał pełną szerokością pod nim.
//
// Odpowiedź jest już sformatowana do tekstu przez rodzica (formatujOdpowiedz),
// bo on ma pod ręką question_type, opcje i drużyny - panel renderuje czysty
// string. Punkty pokazujemy tylko dla pytań rozliczonych (isSettled) -
// inaczej "— czeka" (analogicznie do cudzych typów meczowych przed
// rozliczeniem meczu).

import Link from 'next/link';

export default function PanelCudzychOdpowiedzi({
  pending,
  blad,
  odpowiedzi,
  isSettled,
}) {
  return (
    <div className="mt-3 rounded-lg border border-emerald-900/40 bg-emerald-950/40 p-2">
      {pending && (
        <p className="px-2 py-2 text-xs text-emerald-300/70">Ładuję…</p>
      )}
      {blad && !pending && (
        <p className="px-2 py-2 text-xs text-rose-300">{blad}</p>
      )}
      {!pending && !blad && odpowiedzi && odpowiedzi.length === 0 && (
        <p className="px-2 py-2 text-xs text-emerald-300/70">
          Nikt inny nie odpowiedział na to pytanie.
        </p>
      )}
      {!pending && !blad && odpowiedzi && odpowiedzi.length > 0 && (
        <Tabela odpowiedzi={odpowiedzi} isSettled={isSettled} />
      )}
    </div>
  );
}

function Tabela({ odpowiedzi, isSettled }) {
  return (
    <ul className="divide-y divide-emerald-900/40">
      {odpowiedzi.map((o, i) => (
        <li
          key={`${o.userId}-${i}`}
          className={`px-2 py-1.5 ${o.isBot ? 'bg-sky-950/30' : ''}`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <Link
              href={o.userId ? `/uzytkownik/${o.userId}` : '#'}
              className="min-w-0 flex-1 truncate font-semibold text-emerald-200 hover:text-emerald-50 hover:underline"
              title={o.nick}
            >
              {o.nick}
              {o.isBot && (
                <span className="ml-1.5 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                  AI
                </span>
              )}
            </Link>
            <span
              className="min-w-0 shrink-0 max-w-[60%] truncate rounded bg-emerald-900/50 px-1.5 py-0.5 font-mono text-emerald-50"
              title={o.displayAnswer || '—'}
            >
              {o.displayAnswer || '—'}
            </span>
            {isSettled ? (
              <span className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-xs text-emerald-100">
                {o.points ?? 0} pkt
              </span>
            ) : (
              <span className="shrink-0 text-emerald-300/60">— czeka</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Karta pytania bonusowego w panelu admina - tekst, typ, max_points,
// status, licznik odpowiedzi, akcje Edytuj/Rozlicz/Usuń.

import Link from 'next/link';
import StatusBadge from './StatusBadge';
import PrzyciskUsun from './PrzyciskUsun';
import { usunPytanie } from '@/app/akcje/bonusy';

const TYPY_LABEL = {
  team: 'Drużyna',
  boolean: 'Tak/Nie',
  text: 'Tekst',
  number: 'Liczba',
  dropdown_weighted: 'Dropdown ważony',
  boolean_weighted: 'Tak/Nie ważone',
  dropdown_other: 'Dropdown + Inny',
};

export default function KartaPytaniaAdmin({
  pytanie,
  statusBonusow,
  liczbaOdpowiedzi = 0,
}) {
  const status = pytanie.is_settled
    ? 'settled'
    : statusBonusow === 'closed'
      ? 'closed'
      : 'open';
  // text/number rozliczane są w całości ręcznie. dropdown_other ma
  // częściowo automatyczne rozliczanie, ale "Inny" wymaga ręcznego wpisu
  // punktów - dlatego ten typ też pokazuje przycisk "Rozlicz".
  const reczne =
    pytanie.question_type === 'text' ||
    pytanie.question_type === 'number' ||
    pytanie.question_type === 'dropdown_other';

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-800/40 px-2 py-0.5 text-xs font-mono text-emerald-200">
              #{pytanie.order_index}
            </span>
            <StatusBadge status={status} />
            <span className="text-xs text-emerald-200/70">
              {TYPY_LABEL[pytanie.question_type]}
            </span>
            <span className="text-xs text-emerald-200/70">{pytanie.max_points} pkt</span>
            <span className="text-xs text-emerald-200/70">
              {liczbaOdpowiedzi} {liczbaOdpowiedzi === 1 ? 'odpowiedź' : 'odpowiedzi'}
            </span>
          </div>
          <h3 className="mt-2 font-semibold text-emerald-50">{pytanie.text}</h3>
          {pytanie.description && (
            <p className="mt-1 text-sm text-emerald-200/70">{pytanie.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/bonusy/${pytanie.id}/edycja`}
            className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-100 transition hover:bg-emerald-500/10"
          >
            Edytuj
          </Link>
          {reczne && (
            <Link
              href={`/admin/bonusy/${pytanie.id}/rozlicz`}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100 transition hover:bg-amber-500/20"
            >
              Rozlicz
            </Link>
          )}
          <PrzyciskUsun
            akcja={usunPytanie.bind(null, pytanie.id)}
            etykieta={`Usunąć pytanie "${pytanie.text}"? Skasuje też wszystkie odpowiedzi userów.`}
          />
        </div>
      </div>
    </div>
  );
}

// Spójny badge statusu - dla meczów (scheduled/live/finished)
// i pytań bonusowych (open/closed/settled).

const STYLE = {
  scheduled: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  live: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 animate-pulse',
  finished: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/40',
  open: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  closed: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  settled: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/40',
};

const ETYKIETY = {
  scheduled: 'Nadchodzący',
  live: 'Trwa',
  finished: 'Zakończony',
  open: 'Otwarte',
  closed: 'Zamknięte',
  settled: 'Rozliczone',
};

export default function StatusBadge({ status }) {
  const style = STYLE[status] || 'bg-zinc-500/20 text-zinc-200 border-zinc-500/40';
  const etykieta = ETYKIETY[status] || status;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {etykieta}
    </span>
  );
}

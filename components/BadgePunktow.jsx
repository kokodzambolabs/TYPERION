// Mały kolorowy badge pokazujący ile punktów dostał user za typ.
// 3 -> zielony  "3 pkt"
// 2 -> niebieski "2 pkt"
// 1 -> żółty    "1 pkt"
// 0 -> szary    "0 pkt"

const STYLE = {
  3: 'bg-emerald-500/25 text-emerald-100 border-emerald-400/50',
  2: 'bg-sky-500/25 text-sky-100 border-sky-400/50',
  1: 'bg-amber-500/25 text-amber-100 border-amber-400/50',
  0: 'bg-zinc-500/25 text-zinc-200 border-zinc-400/40',
};

export default function BadgePunktow({ punkty }) {
  const n = Number(punkty);
  const style = STYLE[n] ?? STYLE[0];
  const liczba = Number.isFinite(n) ? n : 0;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${style}`}
    >
      <span className="font-mono">{liczba} pkt</span>
    </span>
  );
}

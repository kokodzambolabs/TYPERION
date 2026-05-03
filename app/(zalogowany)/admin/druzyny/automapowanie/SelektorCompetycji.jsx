'use client';

// Mały selector competycji - zmiana wartości od razu wykonuje navigation
// na ?competition=NEW. Server Component reaguje przeładowaniem.

import { useRouter } from 'next/navigation';

export default function SelektorCompetycji({ competition, opcje }) {
  const router = useRouter();

  const onChange = (e) => {
    const nowa = e.target.value;
    router.push(`/admin/druzyny/automapowanie?competition=${nowa}`);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-900/40 bg-emerald-900/20 px-4 py-3">
      <label
        htmlFor="competition"
        className="text-sm font-semibold text-emerald-100"
      >
        Rozgrywki:
      </label>
      <select
        id="competition"
        value={competition}
        onChange={onChange}
        className="rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-1.5 text-sm text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
      >
        {opcje.map((o) => (
          <option key={o.kod} value={o.kod}>
            {o.nazwa} ({o.kod})
          </option>
        ))}
      </select>
    </div>
  );
}

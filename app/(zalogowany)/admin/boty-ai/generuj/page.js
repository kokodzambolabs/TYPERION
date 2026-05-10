// Strona "Wygeneruj typy" - lista nadchodzących meczów z checkboxami.
// Sam panel (filtry, generowanie, postęp) jest komponentem klienta.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/Button';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import PanelGenerowania from './PanelGenerowania';
import { DOZWOLONE_COMPETITIONS, NAZWY_COMPETITIONS } from '@/lib/competitions';

export default async function GenerujPage() {
  const supabase = await createClient();

  // Pobieramy nadchodzące mecze (status scheduled, kickoff > now).
  const teraz = new Date().toISOString();
  const { data: mecze } = await supabase
    .from('matches')
    .select(
      `
        id, kickoff_at, status, competition_code, group_name,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `,
    )
    .eq('status', 'scheduled')
    .gt('kickoff_at', teraz)
    .order('kickoff_at', { ascending: true });

  // Lista botów i mapa "ile typów już ma ten bot na ten mecz".
  // Korzystamy ze service_role - chcemy widzieć wszystkie predictions
  // niezależnie od tego, czyje są.
  // Tylko aktywne boty - wygenerujTypyMasowo i tak pomija wyłączone,
  // więc licznik "× N botów" musi liczyć tylko te aktywne.
  const sb = utworzKlientaServiceRole();
  const { data: boty } = await sb
    .from('profiles')
    .select('id, nick')
    .eq('is_bot', true)
    .eq('bot_active', true);

  const matchIds = (mecze || []).map((m) => m.id);
  let typyMap = new Map(); // matchId -> liczba botów które już typowały
  if (matchIds.length > 0 && boty?.length) {
    const botIds = boty.map((b) => b.id);
    const { data: typy } = await sb
      .from('predictions')
      .select('match_id, user_id')
      .in('match_id', matchIds)
      .in('user_id', botIds);
    for (const t of typy || []) {
      typyMap.set(t.match_id, (typyMap.get(t.match_id) || 0) + 1);
    }
  }

  const meczeZMeta = (mecze || []).map((m) => ({
    id: m.id,
    kickoff_at: m.kickoff_at,
    competition_code: m.competition_code,
    group_name: m.group_name,
    home: m.home_team?.name || `#${m.id}`,
    away: m.away_team?.name || `#${m.id}`,
    botyKtorzyTypowali: typyMap.get(m.id) || 0,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50">
            ⚡ Wygeneruj typy AI
          </h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            Zaznacz mecze - wszystkie boty zostaną odpalone na każdym z nich.
          </p>
        </div>
        <Link href="/admin/boty-ai">
          <Button variant="secondary">← Wróć</Button>
        </Link>
      </div>

      <PanelGenerowania
        mecze={meczeZMeta}
        boty={boty || []}
        kompetycje={DOZWOLONE_COMPETITIONS}
        nazwyKompetycji={NAZWY_COMPETITIONS}
      />
    </main>
  );
}

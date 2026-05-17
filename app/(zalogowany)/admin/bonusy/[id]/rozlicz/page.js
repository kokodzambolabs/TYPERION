// Strona ręcznego rozliczania pytań typu text/number.
// Dla team/boolean - redirect do edycji (tam jest "Rozlicz automatycznie").

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FormularzRozliczania from './FormularzRozliczania';
import {
  zapiszPoprawnaOdpowiedz,
  zapiszPunktyOdpowiedzi,
  oznaczPytanieRozliczone,
} from '@/app/akcje/bonusy';

export default async function RozliczPage({ params }) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: pytanie } = await supabase
    .from('bonus_questions')
    .select('*')
    .eq('id', id)
    .single();

  if (!pytanie) notFound();
  const reczne = ['text', 'number', 'dropdown_other'].includes(
    pytanie.question_type,
  );
  if (!reczne) {
    redirect(`/admin/bonusy/${pytanie.id}/edycja`);
  }

  // Dla dropdown_other pokazujemy WYŁĄCZNIE odpowiedzi "Inny" - resztę
  // rozliczył już automat z opcji. Dla text/number pokazujemy wszystkie.
  let zapytanie = supabase
    .from('bonus_answers')
    .select(
      'id, user_id, answer_text, answer_other_flag, points, profil:user_id ( nick )',
    )
    .eq('question_id', pytanie.id)
    .order('id', { ascending: true });
  if (pytanie.question_type === 'dropdown_other') {
    zapytanie = zapytanie.eq('answer_other_flag', true);
  }
  const { data: odpowiedzi } = await zapytanie;

  // Bind id - klient wysyła tylko listę / FormData / nic.
  const akcjaZapiszPunkty = zapiszPunktyOdpowiedzi.bind(null, pytanie.id);
  const akcjaZapiszPoprawna = zapiszPoprawnaOdpowiedz.bind(null, pytanie.id);
  const akcjaOznaczRozliczone = oznaczPytanieRozliczone.bind(null, pytanie.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-emerald-50">Rozlicz pytanie</h1>
      <p className="mb-6 text-emerald-200/80">
        <span className="font-semibold text-emerald-100">{pytanie.text}</span>
        <br />
        <span className="text-sm">Maksymalna liczba punktów: {pytanie.max_points}</span>
      </p>

      <FormularzRozliczania
        pytanie={pytanie}
        odpowiedzi={odpowiedzi || []}
        akcjaZapiszPunkty={akcjaZapiszPunkty}
        akcjaZapiszPoprawna={akcjaZapiszPoprawna}
        akcjaOznaczRozliczone={akcjaOznaczRozliczone}
      />
    </main>
  );
}

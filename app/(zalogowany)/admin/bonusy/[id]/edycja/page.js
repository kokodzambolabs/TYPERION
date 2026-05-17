// Edycja pytania bonusowego: trzy sekcje na jednej stronie.
// 1) Treść pytania (text, opis, typ, max_points, kolejność)
// 2) Opcje pytania (tylko dla typów ważonych: dropdown_weighted /
//    boolean_weighted / dropdown_other) - tabela z inline edycją punktów,
//    oznaczanie poprawnej.
// 3) Poprawna odpowiedź (tylko dla starych typów team/boolean/text/number)
//    + przycisk "Rozlicz automatycznie" dla typów wspieranych.

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FormularzPytania from '../../FormularzPytania';
import FormularzPoprawnejOdp from './FormularzPoprawnejOdp';
import EdytorOpcji from './EdytorOpcji';
import PrzyciskRozlicz from './PrzyciskRozlicz';
import {
  edytujPytanie,
  zapiszPoprawnaOdpowiedz,
  rozliczAutomatycznie,
} from '@/app/akcje/bonusy';

const TYPY_WAZONE = ['dropdown_weighted', 'boolean_weighted', 'dropdown_other'];

export default async function EdycjaPytaniaPage({ params }) {
  const { id } = await params;

  const supabase = await createClient();

  const [pytanieRes, druzynyRes, odpRes, opcjeRes] = await Promise.all([
    supabase.from('bonus_questions').select('*').eq('id', id).single(),
    supabase
      .from('teams')
      .select('id, name, group_in_tournament')
      .order('name'),
    supabase
      .from('bonus_answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', id),
    supabase
      .from('bonus_question_options')
      .select('id, question_id, opcja_text, punkty, kolejnosc, is_correct')
      .eq('question_id', id)
      .order('kolejnosc', { ascending: true }),
  ]);

  const pytanie = pytanieRes.data;
  const druzyny = druzynyRes.data || [];
  const liczbaOdp = odpRes.count ?? 0;
  const opcje = opcjeRes.data || [];

  if (!pytanie) notFound();

  const akcjaEdytuj = edytujPytanie.bind(null, pytanie.id);
  const akcjaZapiszOdp = zapiszPoprawnaOdpowiedz.bind(null, pytanie.id);
  const akcjaRozlicz = rozliczAutomatycznie.bind(null, pytanie.id);

  const wazone = TYPY_WAZONE.includes(pytanie.question_type);

  const ostrzezenie =
    liczbaOdp > 0
      ? `To pytanie ma już ${liczbaOdp} ${
          liczbaOdp === 1 ? 'odpowiedź' : 'odpowiedzi'
        } userów. Zmiana typu pytania może zniszczyć ich odpowiedzi.`
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">
        Edycja pytania bonusowego
      </h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-emerald-100">Treść pytania</h2>
        <FormularzPytania
          akcja={akcjaEdytuj}
          defaultValues={pytanie}
          ostrzezenie={ostrzezenie}
        />
      </section>

      {wazone && (
        <section className="mb-10">
          <EdytorOpcji
            pytanieId={pytanie.id}
            opcje={opcje}
            questionType={pytanie.question_type}
          />

          <div className="mt-4">
            <PrzyciskRozlicz akcjaRozlicz={akcjaRozlicz} />
          </div>
        </section>
      )}

      {!wazone && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-emerald-100">
            Poprawna odpowiedź
          </h2>
          <FormularzPoprawnejOdp
            pytanie={pytanie}
            druzyny={druzyny}
            akcjaZapisz={akcjaZapiszOdp}
            akcjaRozlicz={akcjaRozlicz}
          />
        </section>
      )}
    </main>
  );
}

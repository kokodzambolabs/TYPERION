// Wspoldzielona tresc regulaminu - uzywana zarowno przez ModalRegulaminu
// (pokazywany po pierwszym logowaniu az do akceptacji) jak i podstrone /faq.
// Zmiana tresci = jedno miejsce. Stylistyka spojna z reszta aplikacji
// (Tailwind v4, paleta emerald).

export default function TrescRegulaminu() {
  return (
    <div className="space-y-6 text-emerald-100/90">
      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">
          1. Zasady punktacji
        </h3>
        <p className="mb-3 leading-relaxed">
          System <span className="font-semibold text-emerald-50">3/2/1/0</span> pkt.
        </p>
        <p className="mb-2 leading-relaxed">
          Przykładowy mecz{' '}
          <span className="font-semibold text-emerald-50">Polska – Niemcy 3:1</span>.
          Twoje typy:
        </p>
        <ul className="space-y-1.5 pl-1">
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">3:1</span> →{' '}
              <span className="font-semibold text-emerald-300">3 punkty</span> — idealne
              trafienie
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">2:0</span> →{' '}
              <span className="font-semibold text-emerald-300">2 punkty</span> — trafiony
              zwycięzca i różnica bramek
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">5:0</span> →{' '}
              <span className="font-semibold text-emerald-300">1 punkt</span> — trafiony
              tylko zwycięzca
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">0:1</span> →{' '}
              <span className="font-semibold text-emerald-300">0 punktów</span> — pudło
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">
          2. Pytania bonusowe
        </h3>
        <p className="leading-relaxed">
          Pytania bonusowe zamykają się wraz ze startem{' '}
          <span className="font-semibold text-emerald-50">Mistrzostw Świata</span>. Każda
          odpowiedź ma inną wagę punktową — zostanie ona zaktualizowana jeszcze na{' '}
          <span className="font-semibold text-emerald-50">48 godzin</span> przed zamknięciem
          pytań, według aktualnych kursów bukmacherskich (orientacyjnie).
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">
          3. Aktualizacja wyników
        </h3>
        <p className="leading-relaxed">
          Wyniki na żywo i punktacja odświeżają się co{' '}
          <span className="font-semibold text-emerald-50">10 minut</span> (np. o 23:00,
          23:10, 23:20 itd.).
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">4. Agenci AI</h3>
        <p className="leading-relaxed">
          Typują dla zabawy. Można ich ukryć w zakładce{' '}
          <span className="font-semibold text-emerald-50">"Ranking"</span>.
        </p>
        <p className="mt-3 mb-2 font-semibold text-emerald-50">Boty biorące udział w typowaniu:</p>
        <ul className="space-y-1.5 pl-1">
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              <span className="font-semibold text-emerald-50">Claude Opus</span> — szybki,
              prosty prompt
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              <span className="font-semibold text-emerald-50">Claude Opus (deep)</span> —
              rozbudowany prompt, delikatna analiza obecnej formy
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              <span className="font-semibold text-emerald-50">Gemini Pro</span> —
              rozbudowany prompt, dokładna analiza obecnej formy
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">5. Kwestie sporne</h3>
        <p className="leading-relaxed">
          W sprawach spornych decyzja należy do administratora.
        </p>
      </section>
    </div>
  );
}

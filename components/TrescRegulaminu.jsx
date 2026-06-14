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
          <span className="font-semibold text-emerald-50">Polska – Niemcy 1:1</span>.
          Twoje typy:
        </p>
        <ul className="space-y-1.5 pl-1">
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">1:1</span> →{' '}
              <span className="font-semibold text-emerald-300">3 punkty</span> — idealne
              trafienie
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">2:2</span> →{' '}
              <span className="font-semibold text-emerald-300">2 punkty</span> — trafiony
              remis z tą samą różnicą bramek
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">0:0</span> →{' '}
              <span className="font-semibold text-emerald-300">2 punkty</span> — trafiony
              remis z tą samą różnicą bramek
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>
              Polska – Niemcy <span className="font-semibold text-emerald-50">2:1</span> →{' '}
              <span className="font-semibold text-emerald-300">0 punktów</span> — pudło (nie
              remis)
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">
          2. Faza pucharowa
        </h3>
        <p className="mb-3 leading-relaxed">
          W fazie pucharowej (od{' '}
          <span className="font-semibold text-emerald-50">1/16 finału</span>) wynik
          meczu rozliczamy <span className="font-semibold text-emerald-50">wyłącznie</span> z
          czasu regulaminowego (<span className="font-semibold text-emerald-50">90 minut</span>),
          niezależnie od tego co stanie się w dogrywce czy rzutach karnych.
        </p>
        <p className="mb-2 leading-relaxed">
          <span className="text-emerald-400">•</span> Przykład: obstawiłeś{' '}
          <span className="font-semibold text-emerald-50">3:1</span>, po 90 min wynik to{' '}
          <span className="font-semibold text-emerald-50">1:1</span>, a po dogrywce{' '}
          <span className="font-semibold text-emerald-50">3:1</span> → punkty liczymy od 1:1
          (trafiony remis = punkty zgodnie z zasadami punktacji).
        </p>
        <p className="leading-relaxed">
          Dodatkowo: jeśli obstawiasz <span className="font-semibold text-emerald-50">remis</span> w
          meczu pucharowym, musisz wskazać które drużyny awansuje dalej (po dogrywce lub karnych).
          Trafienie awansującej drużyny ={' '}
          <span className="font-semibold text-emerald-300">+1 punkt bonusowy</span>.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">
          3. Pytania bonusowe
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
          4. Aktualizacja wyników
        </h3>
        <p className="leading-relaxed">
          Wyniki na żywo i punktacja odświeżają się co{' '}
          <span className="font-semibold text-emerald-50">10 minut</span> (np. o 23:00,
          23:10, 23:20 itd.).
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-emerald-50">5. Agenci AI</h3>
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
        <h3 className="mb-3 text-lg font-bold text-emerald-50">6. Kwestie sporne</h3>
        <p className="leading-relaxed">
          W sprawach spornych decyzja należy do administratora.
        </p>
      </section>
    </div>
  );
}

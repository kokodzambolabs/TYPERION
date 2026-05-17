// Radio buttons z opisami typów pytań bonusowych.
// Dla 'team' i 'boolean' rozliczanie jest automatyczne, dla 'text' i 'number' ręczne.

const OPCJE = [
  {
    value: 'dropdown_weighted',
    label: 'Dropdown ważony',
    desc: 'Lista opcji z różnymi punktami per opcja. Rozliczanie automatyczne — punkty z opcji oznaczonej jako poprawna.',
  },
  {
    value: 'boolean_weighted',
    label: 'Tak / Nie ważone',
    desc: 'Tak vs Nie, różne punkty za każdą odpowiedź (2 opcje: TAK i NIE).',
  },
  {
    value: 'dropdown_other',
    label: 'Dropdown z opcją „Inny”',
    desc: 'Lista opcji + pole tekstowe „Inny”. Trafienie z listy automatycznie; „Inny” ręcznie.',
  },
  {
    value: 'team',
    label: 'Wybór drużyny (stary)',
    desc: 'Rozliczane automatycznie po wpisaniu poprawnej drużyny przez admina.',
  },
  {
    value: 'boolean',
    label: 'Tak / Nie (stary)',
    desc: 'Rozliczane automatycznie po wpisaniu poprawnej odpowiedzi.',
  },
  {
    value: 'text',
    label: 'Wpis tekstowy',
    desc: 'Rozliczane ręcznie - admin punktuje każdą odpowiedź usera osobno.',
  },
  {
    value: 'number',
    label: 'Liczba',
    desc: 'Rozliczane ręcznie - admin punktuje każdą odpowiedź usera osobno.',
  },
];

export default function SelectTypPytania({
  name = 'question_type',
  defaultValue = 'dropdown_weighted',
  value,
  onChange,
}) {
  const controlled = value !== undefined;
  return (
    <div className="space-y-2">
      {OPCJE.map((opcja) => {
        const checkedProps = controlled
          ? { checked: value === opcja.value, onChange: () => onChange?.(opcja.value) }
          : { defaultChecked: defaultValue === opcja.value };
        return (
          <label
            key={opcja.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-3 transition hover:border-emerald-500/60 has-[input:checked]:border-emerald-400 has-[input:checked]:bg-emerald-900/30"
          >
            <input
              type="radio"
              name={name}
              value={opcja.value}
              {...checkedProps}
              required
              className="mt-1 accent-emerald-500"
            />
            <span>
              <span className="block font-semibold text-emerald-100">{opcja.label}</span>
              <span className="block text-xs text-emerald-200/70">{opcja.desc}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

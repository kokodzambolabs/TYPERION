// Select wyboru drużyny - prosty, dla pojedynczych formularzy
// (np. wybór correct_team_id w pytaniu bonusowym).
// Dla formularza meczu (gospodarze + goście, wzajemne filtrowanie)
// używamy inline state'u w FormularzMeczu.jsx.

export default function SelectDruzyna({
  druzyny,
  name,
  defaultValue = '',
  required = true,
  placeholder = 'Wybierz drużynę…',
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      required={required}
      className="w-full rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-3 py-2 text-emerald-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
    >
      <option value="">{placeholder}</option>
      {druzyny.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

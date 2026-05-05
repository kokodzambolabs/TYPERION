import FormularzKodu from './FormularzKodu';

export default function NowyKodPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-emerald-50">
        Nowy kod zaproszenia
      </h1>
      <p className="mb-6 text-sm text-emerald-200/70">
        Wygeneruj kod, daj go znajomemu, a on użyje go przy rejestracji.
        Domyślnie kod jest jednorazowy — możesz to zmienić w polu „Liczba
        użyć”.
      </p>
      <FormularzKodu />
    </main>
  );
}

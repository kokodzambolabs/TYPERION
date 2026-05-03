import FormularzDruzyny from '../FormularzDruzyny';
import { dodajDruzyne } from '@/app/akcje/druzyny';

export default function NowaDruzynaPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-emerald-50">Nowa drużyna</h1>
      <FormularzDruzyny akcja={dodajDruzyne} />
    </main>
  );
}

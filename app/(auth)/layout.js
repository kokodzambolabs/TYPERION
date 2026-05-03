// Layout dla stron logowania/rejestracji/weryfikacji.
// Wycentrowany pojemnik - bez navbara, bo niezalogowany nigdzie nie pójdzie.

export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

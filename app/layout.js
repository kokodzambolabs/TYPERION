import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
});

export const metadata = {
  title: 'Typer Piłkarski',
  description: 'Typuj wyniki meczów i walcz o pierwsze miejsce w rankingu.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-emerald-950 text-emerald-50 font-sans">
        {children}
      </body>
    </html>
  );
}

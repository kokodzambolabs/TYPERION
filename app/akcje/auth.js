'use server';

// Server Actions do logowania, rejestracji i wylogowania.
// Wszystkie funkcje działają na serwerze - klient nigdy nie widzi
// kluczy ani tokenów.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ---------- Schematy walidacji (zod) ----------

const SchematRejestracji = z.object({
  email: z.email({ message: 'Podaj poprawny adres e-mail.' }).trim(),
  password: z
    .string()
    .min(6, { message: 'Hasło musi mieć minimum 6 znaków.' }),
  nick: z
    .string()
    .trim()
    .min(3, { message: 'Nick musi mieć minimum 3 znaki.' })
    .max(20, { message: 'Nick może mieć maksymalnie 20 znaków.' })
    .regex(/^[A-Za-z0-9_-]+$/, {
      message: 'Nick może zawierać tylko litery, cyfry, _ i -.',
    }),
});

const SchematLogowania = z.object({
  email: z.email({ message: 'Podaj poprawny adres e-mail.' }).trim(),
  password: z.string().min(1, { message: 'Podaj hasło.' }),
});

const SchematEmail = z.object({
  email: z.email({ message: 'Podaj poprawny adres e-mail.' }).trim(),
});

const SchematNoweHaslo = z
  .object({
    password: z
      .string()
      .min(6, { message: 'Hasło musi mieć minimum 6 znaków.' }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Hasła nie są takie same.',
    path: ['confirm'],
  });

// ---------- Mapowanie błędów Supabase na ludzkie komunikaty ----------

function ludzkiBlad(message) {
  if (!message) return 'Coś poszło nie tak. Spróbuj ponownie.';
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Nieprawidłowy e-mail lub hasło.';
  if (m.includes('email not confirmed'))
    return 'Konto nie zostało potwierdzone. Sprawdź skrzynkę.';
  if (m.includes('user already registered'))
    return 'Konto z tym e-mailem już istnieje.';
  if (m.includes('duplicate key') && m.includes('nick'))
    return 'Ten nick jest już zajęty.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Za dużo prób. Spróbuj za chwilę.';
  return message;
}

// Składa pełny URL aplikacji (np. https://typer.vercel.app) na podstawie
// nagłówków bieżącego żądania. Supabase wymaga absolutnego linku
// w `emailRedirectTo`.
async function pobierzOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

// ---------- Akcje ----------

export async function zarejestruj(_prevState, formData) {
  const dane = SchematRejestracji.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    nick: formData.get('nick'),
  });

  if (!dane.success) {
    return { error: dane.error.issues[0].message };
  }

  const supabase = await createClient();
  const origin = await pobierzOrigin();

  // Nick przekazujemy w options.data - trafia do raw_user_meta_data,
  // skąd nasz trigger w bazie danych weźmie go i wpisze do profiles.
  // emailRedirectTo decyduje, dokąd Supabase odeśle usera po kliknięciu
  // w link aktywacyjny - prowadzi do naszego Route Handlera.
  const { error } = await supabase.auth.signUp({
    email: dane.data.email,
    password: dane.data.password,
    options: {
      data: { nick: dane.data.nick },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: ludzkiBlad(error.message) };
  }

  // Po rejestracji idziemy na /weryfikacja, e-mail przekazujemy w URL,
  // żeby strona pokazała na jaki adres poszedł link aktywacyjny.
  redirect(`/weryfikacja?email=${encodeURIComponent(dane.data.email)}`);
}

export async function wyslijLinkPonownie(_prevState, formData) {
  const dane = SchematEmail.safeParse({
    email: formData.get('email'),
  });

  if (!dane.success) {
    return { error: dane.error.issues[0].message };
  }

  const supabase = await createClient();
  const origin = await pobierzOrigin();

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: dane.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: ludzkiBlad(error.message) };
  }

  return { ok: 'Wysłaliśmy nowy link aktywacyjny. Sprawdź skrzynkę.' };
}

export async function zaloguj(_prevState, formData) {
  const dane = SchematLogowania.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!dane.success) {
    return { error: dane.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: dane.data.email,
    password: dane.data.password,
  });

  if (error) {
    return { error: ludzkiBlad(error.message) };
  }

  revalidatePath('/', 'layout');
  redirect('/mecze');
}

export async function wyloguj() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

// Wysyła e-mail z linkiem do zresetowania hasła. Link prowadzi do
// /auth/reset (Route Handler), który wymienia kod na sesję i przerzuca
// usera na /nowe-haslo. Zwracamy zawsze ten sam komunikat sukcesu - nawet
// gdy email nie istnieje w bazie, żeby nie ujawniać czy konto istnieje.
export async function wyslijLinkResetuHasla(_prev, formData) {
  const dane = SchematEmail.safeParse({
    email: formData.get('email'),
  });
  if (!dane.success) {
    return { error: dane.error.issues[0].message };
  }

  const supabase = await createClient();
  const origin = await pobierzOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(dane.data.email, {
    redirectTo: `${origin}/auth/reset`,
  });

  if (error) {
    if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
      return { error: 'Za dużo prób. Spróbuj za chwilę.' };
    }
  }

  return {
    ok: 'Sprawdź skrzynkę pocztową. Wysłaliśmy link do resetu hasła.',
  };
}

// Ustawia nowe hasło po kliknięciu w link z maila. Wymaga aktywnej sesji
// (Route Handler /auth/reset wcześniej wymienił code na cookie).
export async function ustawNoweHaslo(_prev, formData) {
  const parsed = SchematNoweHaslo.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        'Sesja resetu hasła wygasła. Otwórz ponownie link z maila albo wyślij nowy.',
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: ludzkiBlad(error.message) };
  }

  revalidatePath('/', 'layout');
  redirect('/mecze');
}

'use server';

// Server Actions dla AI botów typujących mecze.
//
//   wygenerujTypDlaMeczu(botUserId, matchId)
//     - waliduje admina, wywołuje endpoint /api/generuj-typ-pojedynczy
//       z await (1 wywołanie zwykle <60s), zwraca wynik do UI.
//
//   wygenerujTypyMasowo(matchIds)
//     - dla wszystkich aktywnych botów × każdego z meczów wysyła osobne
//       żądanie POST do /api/generuj-typ-pojedynczy w trybie FIRE-AND-FORGET
//       (fetch BEZ await). Każde takie żądanie ma własny 300s budget na
//       Vercel. Server Action wraca natychmiast z listą zleconych zadań.
//       Wyniki widać w /admin/boty-ai/logi po 2-3 min.
//
//   utworzBotaAI({ nick, email, ai_provider, ai_model, ai_prompt_type })
//     - tworzy auth user przez Supabase Admin API i profile z is_bot=true.
//
// Endpoint generuje typy przez service_role (RLS by zablokował insert
// w imieniu innego usera). Server Action nie dotyka już AI bezpośrednio.

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { utworzKlientaServiceRole } from '@/lib/supabase/admin';
import { uruchomCronBotow } from '@/lib/ai-typer/cronBotow';

async function sprawdzAdminaWAkcji() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak sesji - zaloguj się ponownie.' };

  const { data: profil } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profil?.is_admin) {
    return { error: 'Brak uprawnień admina.' };
  }
  return { user };
}

// Buduje absolutny baseUrl z nagłówków bieżącego żądania (Vercel + lokalnie).
async function pobierzBaseUrl() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto =
    h.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// Pojedyncze typowanie z UI (1 bot × 1 mecz). Czekamy na wynik - zazwyczaj
// <60s, więc nie ma problemu z timeoutami Vercel. Pod spodem ten sam
// endpoint, który napędza generowanie masowe i crona - jeden punkt prawdy.
export async function wygenerujTypDlaMeczu(botUserId, matchId) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  if (!botUserId || !matchId) {
    return { error: 'Wymagane: botUserId i matchId.' };
  }
  if (!process.env.CRON_SECRET) {
    return { error: 'Brak CRON_SECRET w env - skonfiguruj zmienną.' };
  }

  const baseUrl = await pobierzBaseUrl();

  try {
    // AbortController na wypadek długiego AI - Server Action ma własny
    // budżet (na Hobby 300s), nie chcemy wisieć w nieskończoność.
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 290 * 1000);

    const res = await fetch(`${baseUrl}/api/generuj-typ-pojedynczy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ botUserId, matchId }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      return { error: data?.error || `HTTP ${res.status}` };
    }

    revalidatePath('/admin/boty-ai');
    revalidatePath('/admin/boty-ai/logi');
    revalidatePath('/mecze');

    return {
      ok: true,
      bot: data.bot,
      home: data.home,
      away: data.away,
      cost: data.cost,
      tokensInput: data.tokensInput,
      tokensOutput: data.tokensOutput,
    };
  } catch (e) {
    return { error: `Błąd wywołania endpointa: ${e.message}` };
  }
}

// Masowe typowanie - FIRE-AND-FORGET.
// Server Action filtruje pary (bot × mecz), które jeszcze nie mają
// predictions, i dla każdej takiej pary uruchamia osobne wywołanie HTTP
// do endpointa BEZ await. Zwraca natychmiast liczbę zleconych zadań.
// Wyniki pojawią się w /admin/boty-ai/logi w miarę kończenia pracy
// poszczególnych botów.
export async function wygenerujTypyMasowo(matchIds) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    return { error: 'Wybierz przynajmniej jeden mecz.' };
  }
  if (!process.env.CRON_SECRET) {
    return { error: 'Brak CRON_SECRET w env - skonfiguruj zmienną.' };
  }

  const sb = utworzKlientaServiceRole();

  const { data: boty, error: botyE } = await sb
    .from('profiles')
    .select('id, nick')
    .eq('is_bot', true)
    .eq('bot_active', true)
    .order('created_at', { ascending: true });

  if (botyE) return { error: `Błąd pobrania botów: ${botyE.message}` };
  if (!boty || boty.length === 0) {
    return {
      error:
        'Brak aktywnych botów AI w bazie. Utwórz lub włącz boty w panelu admina.',
    };
  }

  // Pomijamy pary już otypowane - inaczej re-generujemy istniejące typy.
  // Jedno query zamiast n × maybeSingle().
  const botIds = boty.map((b) => b.id);
  const { data: istniejace } = await sb
    .from('predictions')
    .select('user_id, match_id')
    .in('match_id', matchIds)
    .in('user_id', botIds);
  const otypowane = new Set(
    (istniejace || []).map((p) => `${p.user_id}:${p.match_id}`),
  );

  const zadania = [];
  for (const bot of boty) {
    for (const matchId of matchIds) {
      if (otypowane.has(`${bot.id}:${matchId}`)) continue;
      zadania.push({ botUserId: bot.id, matchId, botNick: bot.nick });
    }
  }

  if (zadania.length === 0) {
    return {
      ok: true,
      zlecone: 0,
      botow: boty.length,
      meczow: matchIds.length,
      info: 'Wszystkie pary bot×mecz już mają typy. Nic do zlecenia.',
    };
  }

  const baseUrl = await pobierzBaseUrl();

  // Fire-and-forget: NIE awaitujemy fetcha. Każde wywołanie startuje na
  // serwerze niezależnie i ma własny 300s budget. Server Action wraca
  // natychmiast - UI nie blokuje się na 18 × 60s = 18 min.
  for (const zad of zadania) {
    fetch(`${baseUrl}/api/generuj-typ-pojedynczy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        botUserId: zad.botUserId,
        matchId: zad.matchId,
      }),
      cache: 'no-store',
    }).catch((e) => {
      console.error(
        `[fire-and-forget] błąd zlecania bot=${zad.botNick} match=${zad.matchId}:`,
        e?.message,
      );
    });
  }

  revalidatePath('/admin/boty-ai');

  return {
    ok: true,
    zlecone: zadania.length,
    botow: boty.length,
    meczow: matchIds.length,
    info: `Zlecono ${zadania.length} zadań typowania. Boty pracują w tle - sprawdź /admin/boty-ai/logi za 2-3 minuty.`,
  };
}

// Tworzy auth.user dla bota (przez Admin API service_role) i profile
// z is_bot=true. Email jest sztuczny (nie używany do logowania), hasło
// jest losowe (boty się nie logują - kontaktują się z bazą tylko przez
// service_role w Server Action).
export async function utworzBotaAI({
  nick,
  email,
  ai_provider,
  ai_model,
  ai_prompt_type,
}) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  if (!nick || !email || !ai_provider || !ai_model || !ai_prompt_type) {
    return { error: 'Uzupełnij wszystkie pola.' };
  }
  if (!['anthropic', 'google', 'openai'].includes(ai_provider)) {
    return { error: 'Nieprawidłowy provider.' };
  }
  if (!['deep_research', 'deep_research_thinking', 'quick'].includes(ai_prompt_type)) {
    return { error: 'Nieprawidłowy typ promptu.' };
  }

  const sb = utworzKlientaServiceRole();

  // Czy nick już zajęty? profiles.nick UNIQUE - lepiej dać miły błąd.
  const { data: zajety } = await sb
    .from('profiles')
    .select('id')
    .eq('nick', nick)
    .maybeSingle();
  if (zajety) {
    return { error: `Nick "${nick}" jest już zajęty.` };
  }

  // Losowe hasło 32 znaki - i tak nikt się nie loguje.
  const haslo =
    'bot_' +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2);

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: haslo,
    email_confirm: true,
    user_metadata: { nick },
  });

  if (createErr) {
    return { error: `Błąd tworzenia auth user: ${createErr.message}` };
  }
  const newId = created?.user?.id;
  if (!newId) {
    return { error: 'Nie udało się utworzyć usera (brak id).' };
  }

  // Trigger handle_new_user założył już profil z nickiem z metadata.
  // Aktualizujemy go o pola bota. Jeśli triggera nie ma - upsert dorobi.
  const { error: profErr } = await sb
    .from('profiles')
    .upsert(
      {
        id: newId,
        nick,
        is_bot: true,
        bot_active: true,
        ai_provider,
        ai_model,
        ai_prompt_type,
        regulamin_zaakceptowany: true,
      },
      { onConflict: 'id' },
    );

  if (profErr) {
    // Cofamy auth user - inaczej zostanie sierota bez profilu.
    await sb.auth.admin.deleteUser(newId);
    return { error: `Błąd zapisu profilu: ${profErr.message}` };
  }

  revalidatePath('/admin/boty-ai');
  return { ok: true, id: newId, nick };
}

// Włącza/wyłącza bota (profiles.bot_active). Wyłączony bot nie typuje
// (ani ręcznie, ani z crona), ale jego historia typów i miejsce w
// rankingu pozostają.
export async function przelaczAktywnoscBota(botUserId, aktywny) {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  const sb = utworzKlientaServiceRole();
  const { error } = await sb
    .from('profiles')
    .update({ bot_active: !!aktywny })
    .eq('id', botUserId)
    .eq('is_bot', true);

  if (error) return { error: `Błąd zmiany statusu bota: ${error.message}` };

  revalidatePath('/admin/boty-ai');
  return { ok: true };
}

// Ręczne odpalenie tego, co normalnie robi cron /api/cron/boty-ai:
// mecze startujące w oknie 2h × wszystkie aktywne boty (pomija pary
// już otypowane). Przycisk "🚀 Wymuś teraz" w panelu diagnostyki.
// Po refactorze na fire-and-forget zwraca liczbę zleconych zadań -
// wyniki widać w logach.
export async function wymusGenerowanieBotow() {
  const auth = await sprawdzAdminaWAkcji();
  if (auth.error) return { error: auth.error };

  if (!process.env.CRON_SECRET) {
    return { error: 'Brak CRON_SECRET w env - skonfiguruj zmienną.' };
  }

  const sb = utworzKlientaServiceRole();
  const baseUrl = await pobierzBaseUrl();
  const wynik = await uruchomCronBotow(sb, { baseUrl });

  revalidatePath('/admin/boty-ai');
  revalidatePath('/admin/boty-ai/diagnostyka-cron');
  revalidatePath('/admin/boty-ai/logi');

  if (!wynik.ok) return { error: wynik.error || 'Błąd uruchomienia botów.' };
  return wynik;
}

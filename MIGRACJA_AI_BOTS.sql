-- =====================================================================
-- MIGRACJA: konta AI typujące mecze (boty)
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można go uruchomić wielokrotnie.
--
-- Zakres:
--   1) Rozszerzenie profiles o pola identyfikujące bota AI
--      (is_bot, ai_provider, ai_model, ai_prompt_type, bot_active).
--   2) Tabela ai_typing_logs - zapis każdego wywołania AI
--      (prompt, raw response, tokeny, koszt USD, błąd).
--   3) RLS dla ai_typing_logs - SELECT tylko dla adminów.
--   4) Indeksy pod typowe zapytania (sortowanie, lookup per bot+mecz).
--   5) Migracja porządkowa: wyłączenie Sonneta, czyszczenie ikony robota
--      z nicków, czyszczenie uzasadnień z logów.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Pola na profiles
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_bot boolean not null default false;

alter table public.profiles
  add column if not exists ai_provider text;
-- 'anthropic' | 'google' | 'openai'

alter table public.profiles
  add column if not exists ai_model text;
-- np. 'claude-opus-4-7', 'claude-sonnet-4-6',
--     'gemini-3.1-pro-preview', 'gpt-4o'

alter table public.profiles
  add column if not exists ai_prompt_type text;
-- 'deep_research' | 'deep_research_thinking' | 'quick'

alter table public.profiles
  add column if not exists bot_active boolean not null default true;
-- false = bot wyłączony (nie typuje, ale historia jego typów zostaje)


-- ---------------------------------------------------------------------
-- 2. Tabela logów AI - jedna pozycja per wywołanie modelu
-- ---------------------------------------------------------------------
create table if not exists public.ai_typing_logs (
    id            bigint generated always as identity primary key,
    user_id       uuid references public.profiles(id) on delete cascade,
    match_id      bigint references public.matches(id) on delete cascade,
    ai_provider   text,
    ai_model      text,
    prompt_type   text,
    prompt_used   text,
    raw_response  text,
    parsed_home   int,
    parsed_away   int,
    uzasadnienie  text,
    tokens_input  int,
    tokens_output int,
    cost_usd      numeric(10,6),
    error         text,
    created_at    timestamptz not null default now()
);

create index if not exists idx_ai_logs_user_match
    on public.ai_typing_logs (user_id, match_id);

create index if not exists idx_ai_logs_created
    on public.ai_typing_logs (created_at desc);


-- ---------------------------------------------------------------------
-- 3. RLS - tylko admin czyta logi
-- ---------------------------------------------------------------------
alter table public.ai_typing_logs enable row level security;

drop policy if exists ai_logs_admin_select on public.ai_typing_logs;
create policy ai_logs_admin_select
    on public.ai_typing_logs
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

-- INSERT/UPDATE/DELETE wykonujemy tylko przez service_role w Server Action
-- (utworzKlientaServiceRole) - service_role omija RLS, więc nie potrzebuje
-- osobnych polityk. Brak polityk INSERT/UPDATE/DELETE = userzy zalogowani
-- nie mogą nic dodać ani zmodyfikować.


-- ---------------------------------------------------------------------
-- 4. Migracja porządkowa: stan początkowy botów
-- ---------------------------------------------------------------------
-- Wyłączenie Claude Sonneta - zostaje w bazie, ale przestaje typować.
update public.profiles
   set bot_active = false
 where ai_model = 'claude-sonnet-4-6';

-- Pierwszy Claude Opus (deep_research) przechodzi na 'quick'.
-- Drugi Opus to ten z deep_research_thinking - go nie ruszamy.
update public.profiles
   set ai_prompt_type = 'quick'
 where is_bot = true
   and ai_model = 'claude-opus-4-7'
   and ai_prompt_type = 'deep_research';

-- Czyszczenie ikony 🤖 z nicków oraz dodanie sufixu " (AI)".
-- Trzymamy te dwie operacje sekwencyjnie - pierwszy UPDATE może być no-op
-- jeżeli ktoś już ręcznie poprawił nicki, drugi tylko gdy nick nie ma "(AI)".
update public.profiles
   set nick = trim(replace(nick, '🤖 ', ''))
 where is_bot = true
   and nick like '🤖 %';

update public.profiles
   set nick = nick || ' (AI)'
 where is_bot = true
   and nick not like '%(AI)%';

-- Czyszczenie pola uzasadnienia w istniejących logach (kolumna zostaje
-- na wypadek przyszłej zmiany decyzji; wartości NULL).
update public.ai_typing_logs
   set uzasadnienie = null
 where uzasadnienie is not null;


-- =====================================================================
-- KONIEC SKRYPTU
-- ---------------------------------------------------------------------
-- Po migracji utwórz boty (auth.users + profiles). Dwa warianty:
--
-- A) Przez panel admina (/admin/boty-ai - kafelek "🤖 Utwórz boty AI"):
--    Server Action utworzBotaAI() automatycznie tworzy auth user przez
--    Supabase Admin API i dodaje wiersz do profiles z is_bot=true.
--
-- B) Ręcznie:
--    1. Supabase Dashboard → Authentication → Users → Add user
--       Email: bot1@typerion.local, bot2@typerion.local, bot3@typerion.local
--       Hasło: dowolne (boty się nie logują).
--       Auto Confirm User: TAK.
--    2. Skopiuj UUID każdego usera.
--    3. Wstaw profile (przykład):
--
--    INSERT INTO public.profiles
--      (id, nick, is_bot, ai_provider, ai_model, ai_prompt_type,
--       regulamin_zaakceptowany, bot_active)
--    VALUES
--      ('UUID-1', 'Claude Opus (AI)',        true, 'anthropic',
--       'claude-opus-4-7',         'quick',                  true, true),
--      ('UUID-2', 'Claude Opus (deep) (AI)', true, 'anthropic',
--       'claude-opus-4-7',         'deep_research_thinking', true, true),
--      ('UUID-3', 'Claude Sonnet (AI)',      true, 'anthropic',
--       'claude-sonnet-4-6',       'quick',                  true, false),
--      ('UUID-4', 'Gemini Pro (AI)',         true, 'google',
--       'gemini-3.1-pro-preview',  'deep_research',          true, true);
-- =====================================================================

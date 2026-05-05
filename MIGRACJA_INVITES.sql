-- =====================================================================
-- MIGRACJA INVITES - kody zaproszeń
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można uruchamiać wielokrotnie bez błędów.
--
-- Co robi:
--   1) tworzy tabelę invitation_codes (kody generowane przez admina),
--   2) tworzy tabelę invitation_code_uses (kto użył jakiego kodu - audit),
--   3) włącza RLS i dopisuje polityki tylko dla admina.
--
-- Walidacja kodu przy rejestracji robiona jest w Server Action
-- (app/akcje/auth.js) z użyciem service-role klienta - dlatego nie
-- potrzebujemy polityki SELECT dla zwykłych userów. Anon NIE WIDZI
-- tabeli invitation_codes - to celowe.
--
-- Wklej całość do Supabase -> SQL Editor i kliknij "Run".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela: invitation_codes
-- code      - sam kod, np. 'TYPER-W2X9-K3FT' (UNIQUE),
-- max_uses  - ile razy można użyć (default 1 = jednorazowy),
-- uses_count- ile razy już użyto (inkrementowane przy rejestracji),
-- is_active - admin może dezaktywować kod bez kasowania,
-- expires_at- opcjonalna data wygaśnięcia (NULL = bez limitu).
-- ---------------------------------------------------------------------
create table if not exists public.invitation_codes (
    id          bigint      generated always as identity primary key,
    code        text        not null unique,
    description text,
    max_uses    int         not null default 1 check (max_uses >= 1),
    uses_count  int         not null default 0 check (uses_count >= 0),
    is_active   boolean     not null default true,
    expires_at  timestamptz,
    created_at  timestamptz not null default now(),
    created_by  uuid        references auth.users(id)
);

-- Indeks częściowy - szybkie wyszukiwanie tylko aktywnych kodów
-- przy walidacji w trakcie rejestracji.
create index if not exists idx_invitation_codes_code
    on public.invitation_codes (code)
    where is_active = true;


-- ---------------------------------------------------------------------
-- 2. Tabela: invitation_code_uses
-- Audit log - każde użycie kodu zapisujemy osobnym wierszem.
-- Pozwala adminowi zobaczyć "kto użył kodu X i kiedy".
-- ON DELETE SET NULL - jeśli admin usunie usera/kod, log nie ginie.
-- ---------------------------------------------------------------------
create table if not exists public.invitation_code_uses (
    id       bigint      generated always as identity primary key,
    code_id  bigint      references public.invitation_codes(id) on delete set null,
    user_id  uuid        references auth.users(id)              on delete set null,
    used_at  timestamptz not null default now()
);

create index if not exists idx_invitation_code_uses_code_id
    on public.invitation_code_uses (code_id);


-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.invitation_codes     enable row level security;
alter table public.invitation_code_uses enable row level security;


-- ---------------------------------------------------------------------
-- 4. Polityki RLS dla invitation_codes
-- Dla zwykłych userów: brak dostępu (walidacja kodu po service-role).
-- Dla admina: pełen ALL (panel /admin/zaproszenia).
-- ---------------------------------------------------------------------

drop policy if exists "invitation_codes_admin_all" on public.invitation_codes;
create policy "invitation_codes_admin_all"
    on public.invitation_codes
    for all
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    )
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- ---------------------------------------------------------------------
-- 5. Polityki RLS dla invitation_code_uses
-- Tylko admin czyta (sekcja "Historia użyć"). Zapis robi service-role
-- przy rejestracji - omija RLS.
-- ---------------------------------------------------------------------

drop policy if exists "invitation_code_uses_admin_select" on public.invitation_code_uses;
create policy "invitation_code_uses_admin_select"
    on public.invitation_code_uses
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- =====================================================================
-- KONIEC SKRYPTU
-- ---------------------------------------------------------------------
-- Sprawdzenie:
--   select * from public.invitation_codes order by created_at desc;
--   select * from public.invitation_code_uses order by used_at desc;
-- =====================================================================

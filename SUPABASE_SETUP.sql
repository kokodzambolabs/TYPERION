-- =====================================================================
-- SUPABASE SETUP - Typer piłkarski
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można go uruchamiać wielokrotnie bez błędów.
-- Tworzy 3 tabele, włącza RLS, dodaje polityki i trigger auto-profilu.
-- Wklej całość do Supabase -> SQL Editor i kliknij "Run".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela: profiles
-- Rozszerza auth.users o nasze pola (nick, flaga admina).
-- Klucz główny == id z auth.users (kasacja kaskadowa: usunięcie usera
-- z auth.users automatycznie usuwa jego profil).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id         uuid        primary key references auth.users(id) on delete cascade,
    nick       text        not null unique,
    is_admin   boolean     not null default false,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. Tabela: matches
-- Mecze do typowania. Tworzy je admin, wynik wpisuje system po meczu.
-- ---------------------------------------------------------------------
create table if not exists public.matches (
    id          bigint      generated always as identity primary key,
    home_team   text        not null,
    away_team   text        not null,
    kickoff_at  timestamptz not null,
    home_score  int,
    away_score  int,
    status      text        not null default 'scheduled',
    external_id text,
    created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. Tabela: predictions
-- Typy użytkowników. Jeden user może mieć tylko jeden typ na dany mecz
-- (ograniczenie UNIQUE(user_id, match_id)).
-- Usunięcie usera lub meczu kasuje powiązane typy (CASCADE).
-- ---------------------------------------------------------------------
create table if not exists public.predictions (
    id         bigint      generated always as identity primary key,
    user_id    uuid        not null references auth.users(id)    on delete cascade,
    match_id   bigint      not null references public.matches(id) on delete cascade,
    home_score int         not null,
    away_score int         not null,
    points     int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, match_id)
);


-- ---------------------------------------------------------------------
-- 4. Włączenie Row Level Security na wszystkich tabelach
-- Po włączeniu RLS bez polityk NIKT nie może nic czytać ani zapisywać.
-- Polityki niżej dopuszczają konkretne operacje.
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;


-- ---------------------------------------------------------------------
-- 5. Polityki RLS dla tabeli profiles
-- ---------------------------------------------------------------------

-- SELECT: każdy zalogowany widzi wszystkie profile
-- (potrzebne do rankingu i pokazywania nicków obok typów).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
    on public.profiles
    for select
    to authenticated
    using (true);

-- INSERT: user może utworzyć tylko swój własny profil
-- (id wstawianego wiersza musi być równe id zalogowanego usera).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());

-- UPDATE: user może edytować tylko swój własny profil (np. zmienić nick).
-- Pole is_admin zmieniamy ręcznie przez SQL Editor (service_role omija RLS),
-- nigdy z aplikacji - nikt nie może sam się awansować.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());


-- ---------------------------------------------------------------------
-- 6. Polityki RLS dla tabeli matches
-- ---------------------------------------------------------------------

-- SELECT: każdy zalogowany widzi listę meczów.
drop policy if exists "matches_select_authenticated" on public.matches;
create policy "matches_select_authenticated"
    on public.matches
    for select
    to authenticated
    using (true);

-- INSERT: tylko admin może dodać mecz.
-- Sprawdzamy w profiles, czy zalogowany user ma is_admin = true.
drop policy if exists "matches_insert_admin" on public.matches;
create policy "matches_insert_admin"
    on public.matches
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

-- UPDATE: tylko admin może zmienić mecz (m.in. wpisać wynik ręcznie).
drop policy if exists "matches_update_admin" on public.matches;
create policy "matches_update_admin"
    on public.matches
    for update
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

-- DELETE: tylko admin może usunąć mecz.
drop policy if exists "matches_delete_admin" on public.matches;
create policy "matches_delete_admin"
    on public.matches
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- ---------------------------------------------------------------------
-- 7. Polityki RLS dla tabeli predictions
-- ---------------------------------------------------------------------

-- SELECT: swoje typy widać zawsze, cudze dopiero po starcie meczu
-- (kickoff_at <= now()). Dzięki temu nikt nie podejrzy cudzego typu
-- przed rozpoczęciem meczu.
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff"
    on public.predictions
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from public.matches
            where matches.id = predictions.match_id
              and matches.kickoff_at <= now()
        )
    );

-- INSERT: user może zapisać tylko SWÓJ typ (user_id = auth.uid())
-- i tylko PRZED rozpoczęciem meczu (kickoff_at > now()).
drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff"
    on public.predictions
    for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches
            where matches.id = predictions.match_id
              and matches.kickoff_at > now()
        )
    );

-- UPDATE: user może zmienić tylko swój typ i tylko przed startem meczu.
-- Po kickoff_at edycja zablokowana - dotyczy też pola points.
drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff"
    on public.predictions
    for update
    to authenticated
    using (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches
            where matches.id = predictions.match_id
              and matches.kickoff_at > now()
        )
    )
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches
            where matches.id = predictions.match_id
              and matches.kickoff_at > now()
        )
    );

-- DELETE: user może usunąć tylko swój typ i tylko przed startem meczu.
drop policy if exists "predictions_delete_own_before_kickoff" on public.predictions;
create policy "predictions_delete_own_before_kickoff"
    on public.predictions
    for delete
    to authenticated
    using (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches
            where matches.id = predictions.match_id
              and matches.kickoff_at > now()
        )
    );

-- Uwaga: kolumnę points wpisuje wyłącznie serwer kluczem service_role
-- (Server Action po zakończeniu meczu). service_role omija RLS, więc
-- nie potrzebuje osobnej polityki - userzy nie mogą tknąć points,
-- bo po kickoff_at ich UPDATE jest blokowany powyższą polityką.


-- ---------------------------------------------------------------------
-- 8. Trigger: auto-tworzenie profilu po rejestracji
-- Po wstawieniu nowego wiersza do auth.users (rejestracja użytkownika)
-- automatycznie tworzymy dla niego wiersz w public.profiles.
-- Nick bierzemy z raw_user_meta_data->>'nick' przekazanego przy signUp.
-- SECURITY DEFINER pozwala funkcji zapisać do public.profiles z uprawnieniami
-- właściciela funkcji (omija RLS dla tego konkretnego INSERT-u systemowego).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, nick)
    values (
        new.id,
        new.raw_user_meta_data->>'nick'
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- =====================================================================
-- KONIEC SKRYPTU
-- ---------------------------------------------------------------------
-- Po wklejeniu i uruchomieniu, ustaw siebie ręcznie jako admina komendą:
--
--   update public.profiles
--   set is_admin = true
--   where id = (select id from auth.users where email = 'twoj@email.com');
--
-- (alternatywnie po nicku:)
--
--   update public.profiles set is_admin = true where nick = 'TWOJ_NICK';
-- =====================================================================

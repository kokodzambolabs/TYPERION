# PLAN — Typer piłkarski

> Dokument planu projektu. Na tym etapie **nie piszemy jeszcze kodu aplikacji** — tylko ustalamy, co i w jakiej kolejności zrobimy.
> Zakładamy: Next.js 16 (App Router), JavaScript, Tailwind v4, Supabase (Postgres + Auth + RLS), hosting Vercel.

---

## Słowniczek pojęć (w 2 zdaniach każde)

- **Supabase** — gotowa baza danych (PostgreSQL) w chmurze + system logowania użytkowników. Sami nie piszemy serwera bazy, tylko z niej korzystamy.
- **Tabela** — w bazie danych to coś jak arkusz w Excelu: ma kolumny (np. `nick`, `email`) i wiersze (po jednym na użytkownika).
- **Klucz główny (PK)** — kolumna, która jednoznacznie identyfikuje wiersz (zwykle `id`). Nigdy się nie powtarza.
- **Klucz obcy (FK)** — kolumna, która wskazuje na wiersz z innej tabeli (np. `user_id` w typach pokazuje, czyj to typ).
- **RLS (Row Level Security)** — reguły w bazie, które mówią „kto co może zobaczyć / zmienić”. Bez RLS każdy zalogowany mógłby czytać i nadpisywać cudze dane.
- **Server Action** — funkcja w Next.js, która wykonuje się **na serwerze** (nie w przeglądarce). Bezpieczniejsza, bo użytkownik nie może jej podmienić ani zobaczyć w niej naszych sekretów.
- **Server Component / Client Component** — komponenty strony renderowane na serwerze (domyślnie) albo w przeglądarce (gdy dopiszemy `'use client'` na górze pliku).
- **proxy.js** — w Next.js 16 to plik (na poziomie głównym projektu), który jest „strażnikiem” na każde żądanie HTTP. Sprawdza np. czy user jest zalogowany, zanim pokaże mu chronioną stronę. (W starszych wersjach Next.js to się nazywało `middleware.js`.)

---

## 1. Schemat bazy danych

Supabase trzyma swoich użytkowników w specjalnej, ukrytej tabeli `auth.users` (e‑mail, hasło, kod weryfikacji itd.). My **nie modyfikujemy** tej tabeli — zamiast tego tworzymy własną tabelę `profiles`, która jest „przedłużeniem” usera o nasze pola (nick, czy jest adminem).

Wszystkie nasze tabele żyją w schemacie `public` (domyślny w Postgresie).

### Tabela: `profiles`

| Kolumna      | Typ           | Wymagane | Opis                                                                         |
| ------------ | ------------- | -------- | ---------------------------------------------------------------------------- |
| `id`         | `uuid` PK     | tak      | To samo `id` co w `auth.users` (FK → `auth.users.id`, kasuje się kaskadowo). |
| `nick`       | `text` UNIQUE | tak      | Wyświetlany w rankingu i obok typów. Unikalny w całej aplikacji.             |
| `is_admin`   | `boolean`     | tak      | `false` domyślnie. Tylko admin może dodawać mecze.                           |
| `created_at` | `timestamptz` | tak      | Kiedy założono profil. Domyślnie `now()`.                                    |

**Po co**: Supabase nie pozwala dodać kolumn do `auth.users`, więc trzymamy tu nasze własne dane o userze (nick, rola). Łączymy się przez `id`.

### Tabela: `matches` (mecze)

| Kolumna       | Typ              | Wymagane | Opis                                                                                                              |
| ------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`           | `bigint` PK      | tak      | Auto‑numerowane (`generated always as identity`).                                                                 |
| `home_team_id` | `bigint` FK      | tak      | FK → `teams.id`. Drużyna gospodarzy.                                                                              |
| `away_team_id` | `bigint` FK      | tak      | FK → `teams.id`. Drużyna gości.                                                                                   |
| `kickoff_at`   | `timestamptz`    | tak      | Data i godzina rozpoczęcia. Po tym czasie typy są zablokowane.                                                    |
| `home_score`   | `int`            | nie      | Wynik gospodarzy po meczu. `NULL` dopóki mecz się nie zakończy.                                                   |
| `away_score`   | `int`            | nie      | Wynik gości po meczu. Też `NULL` przed końcem.                                                                    |
| `status`       | `text`           | tak      | `'scheduled'`, `'live'`, `'finished'`. Wyliczane na podstawie czasu i wyniku.                                     |
| `external_id`  | `text`           | nie      | Identyfikator meczu z zewnętrznego API (np. Football‑Data.org), żeby nasz system mógł sam pobrać wynik.           |
| `created_at`   | `timestamptz`    | tak      | Kiedy admin dodał mecz.                                                                                           |

Dodatkowo: **`CHECK (home_team_id <> away_team_id)`** — drużyna nie może grać sama ze sobą. (Przed wstawieniem do bazy wartości i tak są walidowane przez Server Action; CHECK to drugi bezpiecznik.)

**Po co**: lista meczów do typowania. Admin tworzy wpisy (wybierając gospodarzy i gości z istniejących `teams`), a system później dopisuje wynik (`home_score`, `away_score`).

### Tabela: `predictions` (typy)

| Kolumna       | Typ           | Wymagane | Opis                                                                          |
| ------------- | ------------- | -------- | ----------------------------------------------------------------------------- |
| `id`          | `bigint` PK   | tak      | Auto‑numerowane.                                                              |
| `user_id`     | `uuid` FK     | tak      | FK → `auth.users.id`. Czyj to typ.                                            |
| `match_id`    | `bigint` FK   | tak      | FK → `matches.id`. Którego meczu dotyczy.                                     |
| `home_score`  | `int`         | tak      | Typowany wynik gospodarzy.                                                    |
| `away_score`  | `int`         | tak      | Typowany wynik gości.                                                         |
| `points`      | `int`         | nie      | Punkty (0/1/2/3) policzone po meczu. `NULL` dopóki mecz nie skończony.        |
| `created_at`  | `timestamptz` | tak      | Kiedy user pierwszy raz wpisał typ.                                           |
| `updated_at`  | `timestamptz` | tak      | Kiedy ostatnio go zmienił.                                                    |

Dodatkowo: **`UNIQUE(user_id, match_id)`** — jeden user może mieć tylko jeden typ na dany mecz.

**Po co**: tu trzymamy każdy wpisany typ. Po zakończeniu meczu uzupełniamy `points` (3/2/1/0) i to one składają się na ranking.

---

## 1.2 Tabele bonusowe i ustawienia turnieju

Oprócz typowania pojedynczych meczów chcemy mieć **pytania bonusowe** — typy „przed turniejem” w stylu „kto zostanie mistrzem?”, „kto będzie królem strzelców?”, „czy gospodarze wyjdą z grupy?”. Każdy user wypełnia je raz, **przed wspólną datą zamknięcia bonusów**, i dostaje punkty po zakończeniu turnieju.

### Pomysł w skrócie

- Pytania są **dynamiczne** — admin sam je tworzy w panelu (nie hardkodujemy ich w kodzie).
- Pytania mają **różne typy odpowiedzi**: wybór drużyny, tak/nie, wpis tekstowy, liczba.
- Część rozliczana jest **automatycznie** (gdy admin wpisze poprawną odpowiedź), część **ręcznie** (admin punktuje każdą odpowiedź usera osobno — np. dla „króla strzelców” wpisanego z palca).
- Jest **jedna wspólna data zamknięcia** dla wszystkich bonusów — trzymana w jednowierszowej tabeli ustawień turnieju.

### Tabela: `teams` (drużyny)

Słownik drużyn — używany przez `matches` (gospodarze/goście jako FK), `bonus_questions.correct_team_id` i `bonus_answers.answer_team_id`. Admin zarządza listą drużyn pod `/admin/druzyny`.

| Kolumna       | Typ           | Wymagane | Opis                                                                                          |
| ------------- | ------------- | -------- | --------------------------------------------------------------------------------------------- |
| `id`          | `bigint` PK   | tak      | Auto‑numerowane (`generated always as identity`).                                             |
| `name`        | `text` UNIQUE | tak      | Pełna nazwa drużyny (np. „Polska”, „Real Madryt”). Unikalna.                                  |
| `created_at`  | `timestamptz` | tak      | Kiedy admin dodał drużynę. Domyślnie `now()`.                                                 |

**Po co**: jedna lista, do której odwołują się i mecze, i pytania bonusowe. Bez słownika musielibyśmy trzymać nazwy w wielu miejscach i ręcznie pilnować literówek.

### Tabela: `tournament_settings` (ustawienia turnieju)

Tabela zawsze ma **dokładnie jeden wiersz** (z `id = 1`). Trzymamy w niej globalne ustawienia, które dotyczą całego turnieju.

| Kolumna                 | Typ           | Wymagane | Opis                                                                                  |
| ----------------------- | ------------- | -------- | ------------------------------------------------------------------------------------- |
| `id`                    | `smallint` PK | tak      | Zawsze `1`. Wymuszamy `CHECK (id = 1)` — gwarancja jednego wiersza.                   |
| `tournament_name`       | `text`        | tak      | Nazwa turnieju, np. „Mistrzostwa Świata 2026”. Wyświetlana w nagłówku aplikacji.      |
| `bonuses_close_at`      | `timestamptz` | tak      | Moment zamknięcia bonusów — po tej dacie nie da się już zapisywać/edytować odpowiedzi. |
| `tournament_starts_at`  | `timestamptz` | tak      | Kiedy zaczyna się turniej (informacyjnie, do wyświetlenia odliczania).                |
| `updated_at`            | `timestamptz` | tak      | Kiedy ostatnio zmieniono ustawienia. Domyślnie `now()`.                               |

**Po co**: jedno miejsce na „kiedy bonusy się zamykają” i nazwę turnieju. Jednowierszowa tabela jest banalna w obsłudze (zawsze `SELECT * ... WHERE id = 1`) i pozwala mieć RLS bez kombinowania z osobnym schematem konfiguracji.

### Tabela: `bonus_questions` (pytania bonusowe)

Każdy wiersz to jedno pytanie utworzone przez admina.

| Kolumna           | Typ                | Wymagane | Opis                                                                                          |
| ----------------- | ------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `id`              | `bigint` PK        | tak      | Auto‑numerowane.                                                                              |
| `text`            | `text`             | tak      | Treść pytania, np. „Kto zostanie mistrzem?”.                                                  |
| `description`     | `text`             | nie      | Opcjonalne dopowiedzenie/regulamin („liczy się nazwisko i imię”, „bramki samobójcze nie liczą się” itp.). |
| `question_type`   | `text`             | tak      | `'team'`, `'boolean'`, `'text'` lub `'number'`. `CHECK` w bazie pilnuje dozwolonych wartości. |
| `max_points`      | `int`              | tak      | Ile punktów daje poprawna odpowiedź (np. 10 za mistrza, 5 za króla strzelców).                |
| `correct_answer`  | `text`             | nie      | Poprawna odpowiedź zapisana tekstowo (dla typów `text`/`number` — referencja dla admina przy ręcznym rozliczaniu). |
| `correct_team_id` | `bigint` FK        | nie      | FK → `teams.id`. Wypełniane dla `question_type = 'team'` po zakończeniu turnieju.             |
| `correct_boolean` | `boolean`          | nie      | Wypełniane dla `question_type = 'boolean'`.                                                   |
| `order_index`     | `int`              | tak      | Kolejność wyświetlania w UI (mniejsze = wyżej). Domyślnie `0`.                                |
| `is_settled`      | `boolean`          | tak      | `false` domyślnie. Admin ustawia `true`, gdy wszystkie odpowiedzi do tego pytania są rozliczone (punkty wpisane). |
| `created_at`      | `timestamptz`      | tak      | Kiedy admin dodał pytanie. Domyślnie `now()`.                                                 |

**Po co**: lista wszystkich pytań bonusowych w turnieju. Admin wypełnia `correct_*` po turnieju, system (lub admin ręcznie) rozlicza odpowiedzi i flaguje `is_settled = true`.

### Tabela: `bonus_answers` (odpowiedzi userów na pytania bonusowe)

| Kolumna           | Typ           | Wymagane | Opis                                                                                                  |
| ----------------- | ------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `id`              | `bigint` PK   | tak      | Auto‑numerowane.                                                                                      |
| `user_id`         | `uuid` FK     | tak      | FK → `auth.users.id`. Czyja to odpowiedź.                                                             |
| `question_id`     | `bigint` FK   | tak      | FK → `bonus_questions.id`. Na które pytanie.                                                          |
| `answer_text`     | `text`        | nie      | Treść odpowiedzi dla typów `'text'` i `'number'` (liczbę też trzymamy jako tekst, walidujemy w UI).   |
| `answer_team_id`  | `bigint` FK   | nie      | FK → `teams.id`. Wypełniane dla typu `'team'`.                                                        |
| `answer_boolean`  | `boolean`     | nie      | Wypełniane dla typu `'boolean'`.                                                                      |
| `points`          | `int`         | nie      | Przyznane punkty. `NULL` przed rozliczeniem; po rozliczeniu `0` lub `max_points` (auto), albo dowolne (ręczne). |
| `created_at`      | `timestamptz` | tak      | Kiedy user pierwszy raz odpowiedział.                                                                 |
| `updated_at`      | `timestamptz` | tak      | Kiedy ostatnio zmienił odpowiedź.                                                                     |

Dodatkowo: **`UNIQUE(user_id, question_id)`** — jeden user ma tylko jedną odpowiedź na dane pytanie.

**Po co**: tu trzymamy każdy wpis usera. Walidację „który `answer_*` musi być wypełniony” robimy w Server Action (na podstawie `question_type` z `bonus_questions`) — można też dorzucić w bazie `CHECK`, ale na początek wystarczy logika serwerowa.

### Jak rozliczamy odpowiedzi

- **Typy `'team'` i `'boolean'` → automatycznie**. Gdy admin zapisze `correct_team_id` lub `correct_boolean` na pytaniu, Server Action `rozliczPytanie(questionId)` przelatuje wszystkie `bonus_answers` do tego pytania i ustawia `points = max_points` jeśli zgadza się z poprawną odpowiedzią, w przeciwnym razie `points = 0`. Na końcu pytanie dostaje `is_settled = true`.
- **Typy `'text'` i `'number'` → ręcznie**. Pod `/admin/bonusy/[id]/rozlicz` admin widzi listę wszystkich odpowiedzi userów na to pytanie (z polem `points` do wpisania). Po zapisaniu wszystkich punktów ustawia `is_settled = true`. To rozwiązuje problemy typu „Lewandowski” vs „Robert Lewandowski” vs „R. Lewandowski” bez pisania własnego fuzzy matchingu.

### Wpływ na ranking

Ranking pokazuje **trzy kolumny punktów**: bonusowe (suma `points` z `bonus_answers`), z meczów (suma `points` z `predictions`) i sumę zbiorczą. Sortowanie domyślnie po sumie zbiorczej. Szczegóły zapytania — w sekcji „Faza 9”.

---

## 1a. Polityki Row Level Security (RLS)

Po włączeniu RLS na tabeli **nikt nie może z niej nic przeczytać/zapisać**, dopóki nie napiszemy polityki, która coś dopuszcza. Każda polityka to jedno zdanie typu „pozwól na X jeżeli warunek Y”.

### `profiles`

- **SELECT** dla wszystkich zalogowanych — każdy musi widzieć nicki w rankingu.
- **INSERT** tylko gdy `id = auth.uid()` — user może utworzyć swój profil i tylko swój.
- **UPDATE** tylko gdy `id = auth.uid()` — user może zmienić swój nick, ale nie cudzy.
- Pole `is_admin` zmieniamy **ręcznie z poziomu Supabase** (panel SQL) albo z funkcji z `service_role` — nigdy z aplikacji, żeby nikt sam się nie awansował.

### `matches`

- **SELECT** dla wszystkich zalogowanych — każdy widzi listę meczów.
- **INSERT / UPDATE / DELETE** tylko gdy istnieje wiersz w `profiles`, gdzie `id = auth.uid()` i `is_admin = true` — czyli wyłącznie admin.

### `predictions`

- **SELECT**: dla wszystkich zalogowanych (po starcie meczu typy są jawne, żeby ranking i tabela typów były czytelne dla wszystkich). Jeśli chcemy, żeby cudze typy były widoczne **dopiero po `kickoff_at`**, dokładamy warunek `match.kickoff_at <= now() OR user_id = auth.uid()` (zalecane).
- **INSERT** tylko gdy `user_id = auth.uid()` **i** mecz jeszcze się nie zaczął (`kickoff_at > now()`).
- **UPDATE** tylko gdy `user_id = auth.uid()` **i** mecz jeszcze się nie zaczął.
- **DELETE** tylko gdy `user_id = auth.uid()` **i** mecz jeszcze się nie zaczął.
- Kolumnę `points` ustawia **tylko serwer** (Server Action z kluczem `service_role` po zakończeniu meczu) — userzy nie mogą jej dotykać.

### `teams`

- **SELECT** dla wszystkich zalogowanych — każdy musi widzieć listę drużyn (do dropdownów przy meczach i bonusach typu `'team'`).
- **INSERT / UPDATE / DELETE** tylko gdy istnieje wiersz w `profiles`, gdzie `id = auth.uid()` i `is_admin = true` — wyłącznie admin (panel `/admin/druzyny`).

### `tournament_settings`

- **SELECT** dla wszystkich zalogowanych — każdy musi widzieć datę zamknięcia bonusów i nazwę turnieju.
- **INSERT / UPDATE** tylko gdy istnieje wiersz w `profiles`, gdzie `id = auth.uid()` i `is_admin = true`.
- **DELETE** zablokowane dla wszystkich (mamy mieć zawsze jeden wiersz). Ewentualnie zmieniamy go ręcznie z poziomu Supabase SQL.

### `bonus_questions`

- **SELECT** dla wszystkich zalogowanych — każdy widzi listę pytań.
- **INSERT / UPDATE / DELETE** tylko admin (warunek jak wyżej: `is_admin = true`).
- Pola `correct_*` i `is_settled` ustawia **wyłącznie admin** — reguła wynika z polityki UPDATE (nikt poza adminem i tak nie może edytować tej tabeli).

### `bonus_answers`

- **SELECT**:
  - własne odpowiedzi widać zawsze (`user_id = auth.uid()`),
  - cudze odpowiedzi widać **dopiero po `bonuses_close_at`** (warunek: subselect z `tournament_settings` — `(SELECT bonuses_close_at FROM tournament_settings WHERE id = 1) <= now()`). Dzięki temu nikt nie podejrzy obstawień znajomego, dopóki bonusy są otwarte.
- **INSERT** tylko gdy `user_id = auth.uid()` **i** bonusy jeszcze otwarte (`(SELECT bonuses_close_at FROM tournament_settings WHERE id = 1) > now()`).
- **UPDATE** tylko gdy `user_id = auth.uid()` **i** bonusy jeszcze otwarte. Kolumny `points` user nie może zmieniać — pilnujemy tego osobną polityką (UPDATE z warunkiem `points IS NOT DISTINCT FROM old.points`) albo prościej: zostawiamy zwykły UPDATE userowi i zaufaniem polegamy na Server Action; mocniejszy wariant — UPDATE dla usera dopuszcza tylko kolumny `answer_*` i `updated_at`, a `points` zmienia tylko admin/serwer (`service_role`).
- **DELETE** tylko gdy `user_id = auth.uid()` **i** bonusy jeszcze otwarte (lub w ogóle zablokowane — to do decyzji w Fazie 5.5).
- Kolumnę `points` ustawia **tylko serwer/admin** (Server Action z `service_role`, albo polityka UPDATE z warunkiem `is_admin = true`).

> **Ważne**: RLS to nasza pierwsza linia obrony. Nawet gdyby ktoś w przeglądarce „oszukał” formularz i wysłał inne dane do Supabase, baza go odrzuci.

---

## 2. Strony aplikacji

| Ścieżka URL          | Kto ma dostęp           | Co pokazuje / co robi                                                                  |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `/`                  | wszyscy                 | Ekran powitalny + przyciski „Zaloguj się” i „Załóż konto”. Zalogowany → przekierowanie do `/mecze`. |
| `/rejestracja`       | niezalogowani           | Formularz: e‑mail, hasło, nick. Po wysłaniu Supabase wysyła kod weryfikacyjny na maila. |
| `/weryfikacja`       | niezalogowani           | Formularz na 6‑cyfrowy kod z maila. Po poprawnym kodzie konto aktywne.                 |
| `/logowanie`         | niezalogowani           | Formularz: e‑mail + hasło.                                                             |
| `/mecze`             | zalogowani              | Lista meczów: nadchodzące u góry (z polami na typ), zakończone niżej (z punktami).     |
| `/bonusy`            | zalogowani              | Lista pytań bonusowych. Przed `bonuses_close_at` — formularz odpowiedzi (zapisywanie/edycja). Po zamknięciu — własna odpowiedź + przyznane punkty + (opcjonalnie) odpowiedzi innych userów. |
| `/ranking`           | zalogowani              | Tabela: pozycja, nick, **punkty bonusowe**, **punkty z meczów**, **suma**. Sortowanie po sumie malejąco. Top 3 wyróżnione. |
| `/profil`            | zalogowani              | Zmiana nicka, wylogowanie.                                                             |
| `/admin`             | zalogowani **adminowie** | Skrót do panelu (linki do drużyn, meczów, bonusów).                                   |
| `/admin/druzyny`             | zalogowani **adminowie** | Lista drużyn z opcją edycji/usunięcia.                                          |
| `/admin/druzyny/nowa`        | zalogowani **adminowie** | Formularz dodawania drużyny.                                                    |
| `/admin/druzyny/[id]/edycja` | zalogowani **adminowie** | Edycja istniejącej drużyny.                                                     |
| `/admin/mecze`               | zalogowani **adminowie** | Lista meczów z opcją edycji/usunięcia.                                          |
| `/admin/mecze/nowy`          | zalogowani **adminowie** | Formularz: drużyna domowa, gości, data + godzina rozpoczęcia.                   |
| `/admin/mecze/[id]/edycja`   | zalogowani **adminowie** | Edycja meczu (np. wpisanie `external_id`, ręczna korekta wyniku).               |
| `/admin/bonusy`              | zalogowani **adminowie** | Lista pytań bonusowych z filtrami „rozliczone / nierozliczone”.                 |
| `/admin/bonusy/nowe`         | zalogowani **adminowie** | Formularz tworzenia pytania (treść, opis, typ, max_points, kolejność).          |
| `/admin/bonusy/[id]/edycja`  | zalogowani **adminowie** | Edycja pytania + wpisanie poprawnej odpowiedzi (`correct_team_id` / `correct_boolean` / `correct_answer`). Dla `team`/`boolean` przycisk „Rozlicz automatycznie”. |
| `/admin/bonusy/[id]/rozlicz` | zalogowani **adminowie** | Ręczne rozliczanie odpowiedzi — widoczne tylko dla pytań typu `text` i `number`. Lista wszystkich userów z ich odpowiedziami i polem `points` do wpisania. |
| `/admin/ustawienia`          | zalogowani **adminowie** | Formularz ustawień turnieju (`tournament_name`, `bonuses_close_at`, `tournament_starts_at`). |

Strony chronimy w **dwóch miejscach naraz**, bo jedno może się dać obejść:
1. `proxy.js` — szybki strażnik na poziomie URL (przekierowuje niezalogowanych).
2. Wewnątrz strony — sprawdzamy sesję jeszcze raz przed pobraniem danych (tzw. „Data Access Layer”, opisany w dokumentach Next.js 16).

---

## 3. Struktura folderów i plików

```
typer/
├── app/                              # cała aplikacja (App Router)
│   ├── layout.js                     # główny layout (HTML, <body>, fonty, providery)
│   ├── page.js                       # strona startowa (już istnieje, zostanie podmieniona)
│   ├── globals.css                   # globalne style + dyrektywy Tailwind
│   │
│   ├── (auth)/                       # grupa stron logowania (nawiasy = nie wpływa na URL)
│   │   ├── logowanie/page.js
│   │   ├── rejestracja/page.js
│   │   └── weryfikacja/page.js
│   │
│   ├── (zalogowany)/                 # grupa wymagająca zalogowania
│   │   ├── layout.js                 # navbar + sprawdzenie sesji
│   │   ├── mecze/page.js
│   │   ├── bonusy/page.js
│   │   ├── ranking/page.js
│   │   ├── profil/page.js
│   │   └── admin/
│   │       ├── layout.js             # dodatkowy strażnik: tylko is_admin
│   │       ├── page.js
│   │       ├── druzyny/              # CRUD drużyn (lista, nowa, [id]/edycja)
│   │       ├── mecze/                # CRUD meczów (lista, nowy, [id]/edycja)
│   │       ├── bonusy/               # CRUD pytań + [id]/rozlicz dla text/number
│   │       └── ustawienia/page.js    # ustawienia turnieju (nazwa, daty)
│   │
│   └── akcje/                        # Server Actions (funkcje wywoływane z formularzy)
│       ├── auth.js                   # logowanie / rejestracja / wylogowanie / weryfikacja
│       ├── mecze.js                  # dodawanie meczu, pobieranie wyniku
│       ├── typy.js                   # zapisywanie / edytowanie typu
│       ├── punkty.js                 # liczenie i zapisywanie punktów po meczu
│       ├── druzyny.js                # CRUD drużyn
│       ├── bonusy.js                 # pytania i odpowiedzi bonusowe
│       └── ustawienia.js             # ustawienia turnieju (tournament_settings)
│
├── components/                       # komponenty UI wielokrotnego użytku
│   ├── Navbar.jsx
│   ├── KartaMeczu.jsx                # jeden mecz na liście
│   ├── FormularzTypu.jsx
│   ├── TabelaRankingu.jsx
│   └── Button.jsx
│
├── lib/                              # narzędzia i biblioteki
│   ├── supabase/
│   │   ├── client.js                 # klient Supabase do Client Components (przeglądarka)
│   │   ├── server.js                 # klient Supabase do Server Components / Actions
│   │   └── proxy.js                  # klient używany w proxy.js (odświeża sesję)
│   ├── punktacja.js                  # czysta funkcja: (typ, wynik) → 0/1/2/3 pkt
│   └── format.js                     # formatowanie dat, nazw drużyn
│
├── proxy.js                          # strażnik na każde żądanie (Next.js 16!)
├── .env.local                        # klucze do Supabase (nie commitujemy)
├── package.json
└── PLAN.md                           # ten plik
```

> **Uwaga** dotycząca Next.js 16: plik strażnika musi się nazywać dokładnie `proxy.js` i leżeć w głównym folderze projektu. W starszym kursie/poradniku zobaczysz `middleware.js` — to ta sama rzecz, ale po zmianie nazwy w nowej wersji.

---

## 4. Plan implementacji w fazach

Każda faza to jeden „kawałek”. Po każdej powinna działać jakaś widoczna część aplikacji — tak się nie zniechęcasz.

### Faza 0 — Przygotowanie środowiska
- Doinstalowanie pakietów (lista w sekcji 5).
- Utworzenie `.env.local` z kluczami z dashboardu Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Sprawdzenie, że `npm run dev` startuje na `http://localhost:3000`.

### Faza 1 — Baza w Supabase
- W Supabase → **SQL Editor** wklejamy skrypt tworzący 3 tabele (`profiles`, `matches`, `predictions`) z kolumnami z sekcji 1.
- Włączamy RLS na każdej tabeli i dopisujemy polityki z sekcji 1a.
- Dodajemy **trigger**, który po utworzeniu nowego usera w `auth.users` automatycznie tworzy pusty wiersz w `profiles` (z nickiem podanym w `raw_user_meta_data`).

### Faza 2 — Klient Supabase i logowanie
- Tworzymy `lib/supabase/client.js` i `lib/supabase/server.js` (zgodnie z dokumentacją `@supabase/ssr` dla App Router).
- Tworzymy `proxy.js` — odświeża sesję przy każdym żądaniu.
- Strony `/rejestracja`, `/weryfikacja`, `/logowanie` z formularzami wywołującymi Server Actions w `app/akcje/auth.js`.
- Po zalogowaniu user trafia na `/mecze` (na razie pusta strona).
- Wylogowanie z `/profil`.

### Faza 3 — Profil i nick
- Po rejestracji wymuszamy ustawienie nicka (jeśli z jakiegoś powodu trigger go nie ustawił).
- Strona `/profil` pozwala go zmienić.
- Sprawdzenie unikalności nicka (Postgres zrobi to za nas dzięki `UNIQUE`, my tylko ładnie pokażemy błąd).

### Faza 4 — Lista meczów (tylko podgląd)
- `/mecze` — Server Component pobiera listę z `matches` posortowaną po `kickoff_at`.
- Komponent `KartaMeczu` — pokazuje drużyny, datę, status.
- Sekcja „Nadchodzące” i „Zakończone” (rozdział wg `status`).

### Faza 5 — Panel admina i dodawanie meczów
- Strona `/admin/mecze/nowy` z formularzem.
- Server Action `dodajMecz(formData)` w `app/akcje/mecze.js`.
- W layoucie `/admin` strażnik: jak `is_admin = false` → przekierowanie na `/mecze`.
- W Supabase ręcznie ustawiamy `is_admin = true` swojemu kontu (pierwszy admin).

### Faza 5.5 — Pytania bonusowe

To jest „dodatek do dodatku”, ale wystarczająco duży, żeby mu dać własną fazę.

**Baza i ustawienia turnieju**
- W SQL Editorze tworzymy tabele `teams`, `tournament_settings`, `bonus_questions`, `bonus_answers` (sekcja 1.2). Plus refactor `matches`: kolumny `home_team_id` / `away_team_id` (FK do `teams`) zamiast tekstowych `home_team` / `away_team`, plus CHECK `home_team_id <> away_team_id`.
- Włączamy RLS na każdej nowej tabeli i wklejamy polityki z sekcji 1a.
- Wstawiamy do `tournament_settings` startowy wiersz (`id = 1`) z dowolnymi sensownymi wartościami — później admin to nadpisze przez UI.
- Wszystkie powyższe zmiany są spakowane w skrypt `MIGRACJA_FAZA6.sql` (idempotentny — można odpalić wielokrotnie).

**Panel admina — drużyny**
- `/admin/druzyny`, `/admin/druzyny/nowa`, `/admin/druzyny/[id]/edycja` — CRUD drużyn.
- Server Actions w `app/akcje/druzyny.js` (`dodajDruzyne`, `edytujDruzyne`, `usunDruzyne`).
- Lista drużyn zasila zarówno pytania typu `'team'` (wybór poprawnej odpowiedzi i odpowiedzi userów), jak i formularz dodawania/edycji meczów (gospodarze i goście wybierani z `teams`).

**Panel admina — ustawienia turnieju**
- `/admin/ustawienia` — osobna strona, formularz na trzy pola: `tournament_name`, `bonuses_close_at`, `tournament_starts_at`.
- Server Action `zapiszUstawieniaTurnieju(formData)` w `app/akcje/ustawienia.js` — UPDATE `tournament_settings` WHERE `id = 1`.
- Wydzielenie do osobnej strony (zamiast doczepiania do `/admin/bonusy`) zostawia przestrzeń na dosypywanie tu kolejnych globalnych ustawień turnieju (np. system punktacji, limity, motyw).

**Panel admina — bonusy**
- `/admin/bonusy` — lista pytań z filtrami „rozliczone / nierozliczone”. Bez sekcji ustawień turnieju (te są pod `/admin/ustawienia`).
- `/admin/bonusy/nowe` — formularz nowego pytania: treść, opis, typ pytania (radio: team / boolean / text / number), max_points, order_index.
- `/admin/bonusy/[id]/edycja` — edycja pytania **i** wpisanie poprawnej odpowiedzi:
  - typ `'team'` → select z drużyn,
  - typ `'boolean'` → radio tak/nie,
  - typ `'text'`/`'number'` → pole tekstowe (referencyjne, do oka admina przy ręcznym rozliczaniu).
  - Dla `'team'` i `'boolean'` przycisk **„Rozlicz automatycznie”** wywołuje Server Action `rozliczPytanieAuto(questionId)`.
- `/admin/bonusy/[id]/rozlicz` — dostępne tylko dla typów `'text'` i `'number'`. Tabela wszystkich `bonus_answers` z polem `points` do wpisania per user. Server Action `zapiszPunktyOdpowiedzi(questionId, [{answerId, points}])` zapisuje wszystkie punkty jednym ruchem; po wszystkim admin klika „Oznacz jako rozliczone” → `is_settled = true`.

**Server Actions w `app/akcje/bonusy.js`**
- `dodajPytanie(formData)`, `edytujPytanie(id, formData)`, `usunPytanie(id)`.
- `zapiszOdpowiedz({questionId, answerTeamId, answerBoolean, answerText})` — INSERT/UPDATE w `bonus_answers` (jeden per user/pytanie dzięki UNIQUE). Sprawdza `bonuses_close_at > now()` przed zapisem (RLS i tak by zablokował, ale chcemy ładny komunikat).
- `rozliczPytanieAuto(questionId)` — dla `'team'`/`'boolean'`, wpisuje `points = max_points` lub `0` w `bonus_answers`, potem `is_settled = true`.
- `zapiszPunktyOdpowiedzi(questionId, lista)` — dla `'text'`/`'number'`, masowy update `points`.
- `oznaczPytanieRozliczone(questionId)` — `is_settled = true` (osobno, żeby admin sam decydował kiedy „zamykamy temat”).

**Strona dla użytkownika — `/bonusy`**
- Server Component pobiera: `tournament_settings`, listę `bonus_questions` (sortowanie po `order_index`), istniejące odpowiedzi danego usera.
- Stan strony zależy od `bonuses_close_at`:
  - **przed zamknięciem** → formularz: dla każdego pytania pole odpowiedzi pasujące do `question_type`. Przycisk „Zapisz odpowiedzi” (jeden, na cały formularz). Pokazujemy odliczanie do `bonuses_close_at`.
  - **po zamknięciu** → tylko odczyt: własna odpowiedź, status (rozliczone / czeka), przyznane punkty. Jeśli pytanie `is_settled = true` i polityka SELECT na to pozwala — link „pokaż odpowiedzi innych”.
- Komponent `FormularzBonusow.jsx` (client) z pojedynczymi polami dopasowanymi do typu pytania.

**Wpływ na resztę aplikacji**
- Navbar dostaje link `Bonusy` (między `Mecze` a `Ranking`).
- `/ranking` zaczyna pokazywać 3 kolumny — implementacja docelowa w Fazie 9, ale tu już mamy dane potrzebne do tej kalkulacji.
- W layoucie `(zalogowany)` warto pokazać banner „Bonusy zamykają się za…”, dopóki `bonuses_close_at > now()` i user nie wypełnił jeszcze wszystkich pytań.

**Co świadomie zostawiamy na później**
- Powiadomienia mailowe (przypomnij o niewypełnionych bonusach na 24h przed zamknięciem) — Faza 12.
- Edycja pytań po zamknięciu bonusów — domyślnie zablokowana (admin może edytować tylko `correct_*` i `is_settled`, nie zmieniamy `text`/`question_type`/`max_points`, bo to zaburzyłoby retroaktywnie wyniki).

### Faza 6 — Typowanie
- W `KartaMeczu` dla nadchodzących meczów dwa pola na liczby + przycisk „Zapisz typ”.
- Server Action `zapiszTyp({ matchId, home, away })`.
- RLS pilnuje, żeby nie dało się zapisać po `kickoff_at` — w UI dodatkowo pokazujemy „Typowanie zamknięte”.
- Wyświetlanie własnego (i opcjonalnie cudzego) typu na karcie.

### Faza 7 — Pobieranie wyniku z zewnątrz
- Wybór API (np. **Football‑Data.org** ma darmowy plan, wymaga klucza). Klucz zapisujemy w `.env.local` (bez prefiksu `NEXT_PUBLIC_`!).
- Server Action `pobierzWynik(matchId)` używa `external_id` żeby z API wziąć wynik i zapisać `home_score` / `away_score` / `status='finished'`.
- Wywołanie albo ręcznie (przycisk u admina), albo automatycznie z **Vercel Cron** (zaplanowane wywołanie funkcji co X minut).

### Faza 8 — Liczenie punktów
- Czysta funkcja `policzPunkty(typ, wynik)` w `lib/punktacja.js`. Zasady z briefu: 3 / 2 / 1 / 0.
- Po zakończeniu meczu Server Action `policzPunktyMeczu(matchId)` przelatuje wszystkie typy do tego meczu i wpisuje `points`.
- Wywoływane razem z `pobierzWynik` w fazie 7.

### Faza 9 — Ranking
- Strona `/ranking` — Server Component liczy **trzy kolumny punktów**:
  - `bonus_points` — `SUM(points)` z `bonus_answers` per user (NULL traktujemy jako 0),
  - `match_points` — `SUM(points)` z `predictions` per user (NULL → 0),
  - `total_points` — `bonus_points + match_points`.
- Najprościej: jedno zapytanie z `profiles` + dwa `LEFT JOIN LATERAL` (lub dwie podzapytane `SELECT user_id, SUM(points)`), albo zdefiniowany w Postgresie **widok** `v_ranking` z gotowymi kolumnami. Sortujemy malejąco po `total_points`, drugorzędnie po `match_points`.
- Komponent `TabelaRankingu` — pokazuje wszystkie trzy kolumny (bonusowe / mecze / suma). Kolory tła dla top 3 (np. złoty/srebrny/brązowy z palety Tailwinda).

### Faza 10 — Wygląd (Tailwind)
- Spójny styl: kolory, typografia, odstępy.
- Wersja mobilna (Tailwind sam pomaga klasami `sm:`, `md:` itd.).
- Stany: ładowanie (`loading.js`), błąd (`error.js`), pusta lista.

### Faza 11 — Wdrożenie na Vercel
- Połączenie repo na GitHubie z Vercel (nowy projekt, framework: Next.js — wykrywa się sam).
- W Vercel ustawiamy zmienne środowiskowe (te same co w `.env.local`).
- Po `git push` na main → Vercel automatycznie buduje i wystawia.
- W ustawieniach Supabase dodajemy adres z Vercela do listy „Site URL” (żeby maile weryfikacyjne miały poprawny link).

### Faza 12 (opcjonalna) — Drobiazgi
- Powiadomienie e‑mail po zakończeniu kolejki („Twoje punkty: X”).
- Historia typów na profilu.
- Strona statystyk (najlepszy typer tygodnia itp.).

---

## 5. Pakiety npm do doinstalowania

Już mamy: `next`, `react`, `react-dom`, `tailwindcss`, `eslint`.

Doinstalujemy:

| Pakiet              | Po co                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `@supabase/supabase-js` | Główny klient Supabase: zapytania do bazy, logowanie, sesje.                              |
| `@supabase/ssr`         | Pomocnicze funkcje do Next.js App Router (cookies, sesje po stronie serwera). **Najnowszy zalecany pakiet** zamiast starego `auth-helpers-nextjs`. |
| `zod`                   | (opcjonalnie, ale bardzo polecam) walidacja danych z formularzy zanim wyślemy je do bazy. |

Komenda (uruchomimy w fazie 0):

```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

To wszystko — żadnych dodatkowych zależności na razie nie potrzebujemy. Wszystko inne (formularze, fetch, daty) ogarniemy wbudowanymi narzędziami Reacta i Next.js.

---

## Co dalej

Powiedz, czy w planie czegoś brakuje albo coś jest niejasne. Jeśli wszystko OK — startujemy od **Fazy 0** i **Fazy 1** (instalacja paczek + założenie tabel w Supabase). Każdą fazę zrobimy osobno, krok po kroku, z wyjaśnieniem co dokładnie kopiujemy gdzie.

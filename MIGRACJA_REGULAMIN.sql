-- Dodaje pola śledzące akceptację regulaminu przez użytkownika.
-- Po pierwszym zalogowaniu (zalogowany)/layout.js sprawdza
-- regulamin_zaakceptowany i wyświetla ModalRegulaminu jeśli false.
-- Akcja zaakceptujRegulamin() ustawia obie kolumny.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS regulamin_zaakceptowany boolean
NOT NULL DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS regulamin_zaakceptowany_at timestamptz;

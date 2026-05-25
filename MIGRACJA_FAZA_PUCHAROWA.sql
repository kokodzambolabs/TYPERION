-- Migracja bazy danych dla fazy pucharowej MŚ 2026
-- Do uruchomienia w Supabase (idempotentna)

-- Dodaj kolumny do tabeli matches
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS full_time_home_score integer,
  ADD COLUMN IF NOT EXISTS full_time_away_score integer,
  ADD COLUMN IF NOT EXISTS winner_team_id bigint REFERENCES teams(id) ON DELETE SET NULL;

-- Dodaj kolumnę do tabeli predictions
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS winner_team_id bigint REFERENCES teams(id) ON DELETE SET NULL;

-- Dodaj indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_matches_winner_team ON matches(winner_team_id);
CREATE INDEX IF NOT EXISTS idx_predictions_winner_team ON predictions(winner_team_id);

-- Komentarze do dokumentacji
COMMENT ON COLUMN matches.full_time_home_score IS 'Wynik drużyny gospodarzy z 90 minut (czysta gra), używany dla meczów pucharowych';
COMMENT ON COLUMN matches.full_time_away_score IS 'Wynik drużyny gośćmi z 90 minut (czysta gra), używany dla meczów pucharowych';
COMMENT ON COLUMN matches.winner_team_id IS 'ID drużyny awansującej (dla meczów pucharowych, jeśli zakończony)';
COMMENT ON COLUMN predictions.winner_team_id IS 'ID drużyny wskazanej jako awansująca (typowanie na remis w fazie pucharowej)';

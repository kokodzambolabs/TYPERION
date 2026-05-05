-- Dodaje przypisanie drużyny do grupy turniejowej (np. 'GROUP_A')
-- oraz filtr grupy w pytaniach bonusowych typu 'team'.
--
-- teams.group_in_tournament wypełnia akcja aktualizujGrupyDruzyn() na
-- podstawie matches.group_name z meczów MŚ (competition_code='WC').
--
-- bonus_questions.team_group działa jako filtr dropdownu drużyn:
-- jeśli ustawione na 'GROUP_A', user/admin wybiera tylko drużyny gdzie
-- teams.group_in_tournament='GROUP_A'. Jeśli NULL - pokazujemy wszystkie.

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS group_in_tournament text;

ALTER TABLE bonus_questions
ADD COLUMN IF NOT EXISTS team_group text;

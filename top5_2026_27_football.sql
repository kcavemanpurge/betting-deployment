-- top5_2026_27_football.sql
CREATE TABLE IF NOT EXISTS football_leagues_2627 (
  league_code TEXT PRIMARY KEY,
  league_name TEXT NOT NULL,
  country TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2026/2027'
);

CREATE TABLE IF NOT EXISTS football_teams_2627 (
  id SERIAL PRIMARY KEY,
  league_code TEXT NOT NULL REFERENCES football_leagues_2627(league_code),
  team_name TEXT NOT NULL,
  sim_rating INTEGER NOT NULL DEFAULT 75,
  sim_wins INTEGER NOT NULL DEFAULT 0,
  sim_draws INTEGER NOT NULL DEFAULT 0,
  sim_losses INTEGER NOT NULL DEFAULT 0,
  sim_points INTEGER NOT NULL DEFAULT 0,
  UNIQUE (league_code, team_name)
);

CREATE TABLE IF NOT EXISTS football_sim_matches_2627 (
  id BIGSERIAL PRIMARY KEY,
  league_code TEXT NOT NULL REFERENCES football_leagues_2627(league_code),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  odds_wallet TEXT NOT NULL DEFAULT '4AB1u2f16V1Vno2fzN4GTN41MTSWjW4E3ViN4bg3qA4m',
  simulated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO football_leagues_2627 (league_code, league_name, country) VALUES
  ('EPL', 'Premier League', 'England'),
  ('LALIGA', 'La Liga', 'Spain'),
  ('SERIEA', 'Serie A', 'Italy'),
  ('BUNDESLIGA', 'Bundesliga', 'Germany'),
  ('LIGUE1', 'Ligue 1', 'France')
ON CONFLICT (league_code) DO NOTHING;

-- 2026/2027 Premier League (20 clubs)
INSERT INTO football_teams_2627 (league_code, team_name) VALUES
  ('EPL', 'Arsenal'), ('EPL', 'Aston Villa'), ('EPL', 'AFC Bournemouth'), ('EPL', 'Brentford'),
  ('EPL', 'Brighton & Hove Albion'), ('EPL', 'Chelsea'), ('EPL', 'Coventry City'), ('EPL', 'Crystal Palace'),
  ('EPL', 'Everton'), ('EPL', 'Fulham'), ('EPL', 'Hull City'), ('EPL', 'Ipswich Town'),
  ('EPL', 'Leeds United'), ('EPL', 'Liverpool'), ('EPL', 'Manchester City'), ('EPL', 'Manchester United'),
  ('EPL', 'Newcastle United'), ('EPL', 'Nottingham Forest'), ('EPL', 'Sunderland'), ('EPL', 'Tottenham Hotspur')
ON CONFLICT (league_code, team_name) DO NOTHING;

-- 2026/2027 La Liga (20 clubs)
INSERT INTO football_teams_2627 (league_code, team_name) VALUES
  ('LALIGA', 'Alaves'), ('LALIGA', 'Ath Bilbao'), ('LALIGA', 'Atl. Madrid'), ('LALIGA', 'Barcelona'),
  ('LALIGA', 'Betis'), ('LALIGA', 'Celta Vigo'), ('LALIGA', 'Dep. A Coruna'), ('LALIGA', 'Elche'),
  ('LALIGA', 'Espanyol'), ('LALIGA', 'Getafe'), ('LALIGA', 'Levante'), ('LALIGA', 'Malaga'),
  ('LALIGA', 'Osasuna'), ('LALIGA', 'Racing Santander'), ('LALIGA', 'Rayo Vallecano'), ('LALIGA', 'Real Madrid'),
  ('LALIGA', 'Real Sociedad'), ('LALIGA', 'Sevilla'), ('LALIGA', 'Valencia'), ('LALIGA', 'Villarreal')
ON CONFLICT (league_code, team_name) DO NOTHING;

-- 2026/2027 Serie A (20 clubs)
INSERT INTO football_teams_2627 (league_code, team_name) VALUES
  ('SERIEA', 'AC Milan'), ('SERIEA', 'AC Monza'), ('SERIEA', 'ACF Fiorentina'), ('SERIEA', 'AS Roma'),
  ('SERIEA', 'Atalanta BC'), ('SERIEA', 'Bologna FC 1909'), ('SERIEA', 'Cagliari Calcio'), ('SERIEA', 'Como 1907'),
  ('SERIEA', 'Frosinone Calcio'), ('SERIEA', 'Genoa CFC'), ('SERIEA', 'Inter Milan'), ('SERIEA', 'Juventus FC'),
  ('SERIEA', 'Parma Calcio 1913'), ('SERIEA', 'S.S. Lazio'), ('SERIEA', 'SSC Napoli'), ('SERIEA', 'Torino FC'),
  ('SERIEA', 'U.S. Lecce'), ('SERIEA', 'U.S. Sassuolo Calcio'), ('SERIEA', 'Udinese Calcio'), ('SERIEA', 'Venezia FC')
ON CONFLICT (league_code, team_name) DO NOTHING;

-- 2026/2027 Bundesliga (18 clubs)
INSERT INTO football_teams_2627 (league_code, team_name) VALUES
  ('BUNDESLIGA', '1. FC Köln'), ('BUNDESLIGA', '1. FC Union Berlin'), ('BUNDESLIGA', '1. FSV Mainz 05'),
  ('BUNDESLIGA', 'Bayer 04 Leverkusen'), ('BUNDESLIGA', 'Borussia Dortmund'), ('BUNDESLIGA', 'Borussia Mönchengladbach'),
  ('BUNDESLIGA', 'Eintracht Frankfurt'), ('BUNDESLIGA', 'FC Augsburg'), ('BUNDESLIGA', 'FC Bayern München'),
  ('BUNDESLIGA', 'FC Schalke 04'), ('BUNDESLIGA', 'Hamburger SV'), ('BUNDESLIGA', 'RB Leipzig'),
  ('BUNDESLIGA', 'SC Freiburg'), ('BUNDESLIGA', 'SC Paderborn 07'), ('BUNDESLIGA', 'SV Elversberg'),
  ('BUNDESLIGA', 'SV Werder Bremen'), ('BUNDESLIGA', 'TSG Hoffenheim'), ('BUNDESLIGA', 'VfB Stuttgart')
ON CONFLICT (league_code, team_name) DO NOTHING;

-- 2026/2027 Ligue 1 (18 clubs)
INSERT INTO football_teams_2627 (league_code, team_name) VALUES
  ('LIGUE1', 'AJ Auxerre'), ('LIGUE1', 'Angers SCO'), ('LIGUE1', 'AS Monaco'), ('LIGUE1', 'ES Troyes AC'),
  ('LIGUE1', 'FC Lorient'), ('LIGUE1', 'Le Havre AC'), ('LIGUE1', 'Le Mans FC'), ('LIGUE1', 'LOSC Lille'),
  ('LIGUE1', 'OGC Nice'), ('LIGUE1', 'Olympique de Marseille'), ('LIGUE1', 'Olympique Lyonnais'),
  ('LIGUE1', 'Paris FC'), ('LIGUE1', 'Paris Saint-Germain'), ('LIGUE1', 'RC Lens'),
  ('LIGUE1', 'RC Strasbourg'), ('LIGUE1', 'Stade Brestois 29'), ('LIGUE1', 'Stade Rennais'), ('LIGUE1', 'Toulouse FC')
ON CONFLICT (league_code, team_name) DO NOTHING;

CREATE TABLE tournaments(id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL, opens INTEGER NOT NULL, closes INTEGER NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0);
ALTER TABLE results ADD COLUMN tournament TEXT REFERENCES tournaments(id);
CREATE INDEX results_tournament ON results(tournament,uid);

-- Indecsi pentru interogarile frecvente (justificati prin planurile de executie, vezi documentatia).
-- PostgreSQL creeaza automat indecsi pentru PRIMARY KEY si UNIQUE, dar NU pentru cheile straine.

-- "Rezervarile mele" si orice cautare de rezervari dupa client
CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON rentals (user_id);

-- suma platita pe rezervare (liste de rezervari, "Rezervarile mele", plati)
CREATE INDEX IF NOT EXISTS idx_payments_rental_id ON payments (rental_id);

-- login: cautarea se face cu lower(email), iar indexul unic existent pe email nu poate fi
-- folosit pentru aceasta expresie; indexul este si unic, deci nu pot exista doua conturi
-- care difera doar prin litere mari/mici
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

-- rapoarte: incasari pe perioade
CREATE INDEX IF NOT EXISTS idx_payments_data_plata ON payments (data_plata);

ANALYZE;
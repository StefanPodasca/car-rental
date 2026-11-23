-- Date mari pentru masurarea performantei. NU se foloseste in baza de date a aplicatiei,
-- ci doar in baza separata "carrental_perf" (vezi documentatia).
-- Se ruleaza dupa 01_schema.sql, pe o baza goala.

INSERT INTO roles (nume) VALUES ('client'), ('angajat'), ('admin');

INSERT INTO categories (nume, descriere) VALUES
                                             ('Economy', 'Masini mici si economice'),
                                             ('Compact', 'Masini de familie'),
                                             ('SUV', 'Masini inalte'),
                                             ('Premium', 'Masini de lux');

-- 20.000 de clienti (acelasi hash pentru toti, ca generarea sa fie rapida); parola: Parola123!
WITH h AS (SELECT crypt('Parola123!', gen_salt('bf', 10)) AS hash)
INSERT INTO users (nume, email, parola_hash, telefon, role_id)
SELECT 'Utilizator ' || g, 'user' || g || '@example.com', h.hash,
       '07' || lpad(g::text, 8, '0'), 1
FROM generate_series(1, 20000) g, h;

-- conturi cu rol de angajat si admin
WITH h AS (SELECT crypt('Parola123!', gen_salt('bf', 10)) AS hash)
INSERT INTO users (nume, email, parola_hash, telefon, role_id)
SELECT v.nume, v.email, h.hash, v.tel, v.role_id
FROM h, (VALUES
             ('Admin Principal', 'admin@carrental.ro', '0740000001', 3),
             ('Maria Ionescu',   'maria@carrental.ro', '0740000002', 2)
) AS v(nume, email, tel, role_id);

-- 2.000 de masini
INSERT INTO cars (marca, model, an, numar_inmatriculare, pret_pe_zi, stare, category_id)
SELECT (ARRAY['Dacia','Renault','Volkswagen','Skoda','Ford','Toyota','BMW','Mercedes'])[1 + g % 8],
       'Model ' || (g % 25),
       2015 + g % 10,
       'GL ' || lpad(g::text, 5, '0'),
       80 + (g % 40) * 10,
       'disponibila',
       1 + g % 4
FROM generate_series(1, 2000) g;

INSERT INTO extras (nume, pret_pe_zi) VALUES
                                          ('GPS', 15), ('Scaun copil', 20), ('Asigurare completa', 40), ('Sofer suplimentar', 25);

-- 200.000 de rezervari: cate 100 pe masina, fara suprapuneri (perioade de 4 zile, din 6 in 6 zile)
INSERT INTO rentals (user_id, car_id, data_start, data_end, stare, pret_total)
SELECT 1 + (g::bigint * 7919) % 20000,
       1 + g % 2000,
       DATE '2023-01-01' + (g / 2000) * 6,
       DATE '2023-01-01' + (g / 2000) * 6 + 4,
       (ARRAY['finalizata','finalizata','finalizata','anulata','confirmata'])[1 + g % 5],
       400
FROM generate_series(0, 199999) g;

-- optiuni la jumatate dintre rezervari
INSERT INTO rental_extras (rental_id, extra_id, cantitate)
SELECT g, 1 + g % 4, 1 FROM generate_series(1, 100000) g;

-- 250.000 de plati, pe aproximativ 20 de luni
INSERT INTO payments (rental_id, suma, metoda, data_plata)
SELECT 1 + g % 200000,
       100,
       (ARRAY['numerar','card','transfer'])[1 + g % 3],
       TIMESTAMP '2023-01-01' + (g % 600) * INTERVAL '1 day'
FROM generate_series(1, 250000) g;

ANALYZE;

SELECT (SELECT count(*) FROM users) AS utilizatori,
       (SELECT count(*) FROM cars) AS masini,
       (SELECT count(*) FROM rentals) AS rezervari,
       (SELECT count(*) FROM payments) AS plati;
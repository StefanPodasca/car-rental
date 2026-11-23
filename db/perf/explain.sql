\echo
\echo '=== Q1: Rezervarile unui client (pagina "Rezervarile mele") ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id,
       c.marca || ' ' || c.model AS masina,
       to_char(r.data_start, 'YYYY-MM-DD') AS data_start,
       to_char(r.data_end, 'YYYY-MM-DD') AS data_end,
       r.stare, r.pret_total,
       COALESCE((SELECT sum(p.suma) FROM payments p WHERE p.rental_id = r.id), 0) AS platit,
       COALESCE((SELECT string_agg(e.nume || ' x' || re.cantitate, ', ' ORDER BY e.nume)
                 FROM rental_extras re JOIN extras e ON e.id = re.extra_id
                 WHERE re.rental_id = r.id), '') AS optiuni
FROM rentals r
         JOIN cars c ON c.id = r.car_id
WHERE r.user_id = 4242
ORDER BY r.data_start DESC, r.id DESC;

\echo
\echo '=== Q2: Autentificare (cautare utilizator dupa email) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.id, u.nume, u.email, u.parola_hash, r.nume AS rol
FROM users u
         JOIN roles r ON r.id = u.role_id
WHERE lower(u.email) = lower('user4242@example.com');

\echo
\echo '=== Q3: Catalog (masini libere intr-o perioada, pe categorie) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.id, c.marca, c.model, c.an, c.pret_pe_zi, cat.nume AS categorie
FROM cars c
         JOIN categories cat ON cat.id = c.category_id
WHERE c.stare <> 'service'
  AND c.category_id = 3
  AND NOT EXISTS (
    SELECT 1 FROM rentals r
    WHERE r.car_id = c.id AND r.stare <> 'anulata'
      AND daterange(r.data_start, r.data_end, '[)')
    && daterange('2024-03-01'::date, '2024-03-05'::date, '[)')
)
ORDER BY c.pret_pe_zi, c.id;

\echo
\echo '=== Q4: Raport (incasari pe metoda de plata, intr-o saptamana) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT metoda, count(*) AS nr_plati, sum(suma) AS total
FROM payments
WHERE data_plata >= '2024-03-01' AND data_plata < '2024-03-08'
GROUP BY metoda;
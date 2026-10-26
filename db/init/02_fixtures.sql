INSERT INTO roles (nume) VALUES ('client'), ('angajat'), ('admin');

-- parola pentru toate conturile de test: Parola123!
INSERT INTO users (nume, email, parola_hash, telefon, role_id) VALUES
                                                                   ('Admin Principal', 'admin@carrental.ro',   crypt('Parola123!', gen_salt('bf', 10)), '0740000001', 3),
                                                                   ('Maria Ionescu',   'maria@carrental.ro',   crypt('Parola123!', gen_salt('bf', 10)), '0740000002', 2),
                                                                   ('Andrei Popa',     'andrei@carrental.ro',  crypt('Parola123!', gen_salt('bf', 10)), '0740000003', 2),
                                                                   ('Ioana Dumitru',   'ioana@example.com',    crypt('Parola123!', gen_salt('bf', 10)), '0740000004', 1),
                                                                   ('Mihai Stan',      'mihai@example.com',    crypt('Parola123!', gen_salt('bf', 10)), '0740000005', 1),
                                                                   ('Elena Radu',      'elena@example.com',    crypt('Parola123!', gen_salt('bf', 10)), '0740000006', 1),
                                                                   ('Vlad Marin',      'vlad@example.com',     crypt('Parola123!', gen_salt('bf', 10)), '0740000007', 1),
                                                                   ('Ana Georgescu',   'ana@example.com',      crypt('Parola123!', gen_salt('bf', 10)), '0740000008', 1);

INSERT INTO categories (nume, descriere) VALUES
                                             ('Economy', 'Masini mici si economice, ideale pentru oras'),
                                             ('Compact', 'Masini de familie, confortabile pe distante medii'),
                                             ('SUV', 'Masini inalte, potrivite pentru drumuri variate'),
                                             ('Premium', 'Masini de lux pentru ocazii speciale');

INSERT INTO cars (marca, model, an, numar_inmatriculare, pret_pe_zi, stare, category_id) VALUES
                                                                                             ('Dacia',      'Logan',    2022, 'GL 01 ABC', 150, 'disponibila', 1),
                                                                                             ('Dacia',      'Sandero',  2023, 'GL 02 ABC', 160, 'disponibila', 1),
                                                                                             ('Renault',    'Clio',     2022, 'GL 03 DEF', 180, 'disponibila', 1),
                                                                                             ('Volkswagen', 'Golf',     2021, 'GL 04 GHI', 230, 'disponibila', 2),
                                                                                             ('Skoda',      'Octavia',  2023, 'GL 05 JKL', 250, 'inchiriata',  2),
                                                                                             ('Ford',       'Focus',    2022, 'GL 06 MNO', 220, 'disponibila', 2),
                                                                                             ('Dacia',      'Duster',   2023, 'GL 07 PQR', 280, 'disponibila', 3),
                                                                                             ('Toyota',     'RAV4',     2024, 'GL 08 STU', 380, 'disponibila', 3),
                                                                                             ('BMW',        'Seria 5',  2023, 'GL 09 VWX', 550, 'service',     4),
                                                                                             ('Mercedes',   'E-Class',  2024, 'GL 10 YZA', 650, 'disponibila', 4);

INSERT INTO extras (nume, pret_pe_zi) VALUES
                                          ('GPS', 15), ('Scaun copil', 20), ('Asigurare completa', 40), ('Sofer suplimentar', 25);

INSERT INTO rentals (user_id, car_id, data_start, data_end, stare, pret_total) VALUES
                                                                                   (4, 1,  '2026-09-01', '2026-09-05', 'finalizata',  600),
                                                                                   (5, 4,  '2026-09-10', '2026-09-13', 'finalizata',  735),
                                                                                   (6, 7,  '2026-09-20', '2026-09-27', 'finalizata',  2100),
                                                                                   (4, 10, '2026-10-01', '2026-10-04', 'finalizata',  1950),
                                                                                   (7, 5,  '2026-10-24', '2026-10-29', 'activa',      1250),
                                                                                   (8, 2,  '2026-10-30', '2026-11-02', 'confirmata',  480),
                                                                                   (5, 8,  '2026-11-05', '2026-11-10', 'in_asteptare', 2100),
                                                                                   (6, 3,  '2026-10-15', '2026-10-18', 'anulata',     540);

INSERT INTO rental_extras (rental_id, extra_id, cantitate) VALUES
                                                               (2, 1, 1), (3, 2, 1), (7, 3, 1);

INSERT INTO payments (rental_id, suma, metoda) VALUES
                                                   (1, 600,  'card'),
                                                   (2, 735,  'numerar'),
                                                   (3, 2100, 'transfer'),
                                                   (4, 1950, 'card'),
                                                   (5, 500,  'card'),
                                                   (6, 200,  'numerar');
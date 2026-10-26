CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (
                       id SERIAL PRIMARY KEY,
                       nume VARCHAR(20) NOT NULL UNIQUE
                           CHECK (nume IN ('client', 'angajat', 'admin'))
);

CREATE TABLE users (
                       id SERIAL PRIMARY KEY,
                       nume VARCHAR(100) NOT NULL,
                       email VARCHAR(150) NOT NULL UNIQUE,
                       parola_hash VARCHAR(100) NOT NULL,
                       telefon VARCHAR(20),
                       role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                       created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE categories (
                            id SERIAL PRIMARY KEY,
                            nume VARCHAR(50) NOT NULL UNIQUE,
                            descriere TEXT
);

CREATE TABLE cars (
                      id SERIAL PRIMARY KEY,
                      marca VARCHAR(50) NOT NULL,
                      model VARCHAR(50) NOT NULL,
                      an INT NOT NULL CHECK (an BETWEEN 2000 AND 2100),
                      numar_inmatriculare VARCHAR(15) NOT NULL UNIQUE,
                      pret_pe_zi NUMERIC(8,2) NOT NULL CHECK (pret_pe_zi > 0),
                      stare VARCHAR(20) NOT NULL DEFAULT 'disponibila'
                          CHECK (stare IN ('disponibila', 'inchiriata', 'service')),
                      category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE rentals (
                         id SERIAL PRIMARY KEY,
                         user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                         car_id INT NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
                         data_start DATE NOT NULL,
                         data_end DATE NOT NULL,
                         stare VARCHAR(20) NOT NULL DEFAULT 'in_asteptare'
                             CHECK (stare IN ('in_asteptare', 'confirmata', 'activa', 'finalizata', 'anulata')),
                         pret_total NUMERIC(10,2) NOT NULL CHECK (pret_total >= 0),
                         created_at TIMESTAMP NOT NULL DEFAULT now(),
                         CHECK (data_end > data_start),
    -- aceeasi masina nu poate avea doua rezervari care se suprapun
                         EXCLUDE USING gist (
        car_id WITH =,
        daterange(data_start, data_end, '[)') WITH &&
    ) WHERE (stare <> 'anulata')
);

CREATE TABLE payments (
                          id SERIAL PRIMARY KEY,
                          rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
                          suma NUMERIC(10,2) NOT NULL CHECK (suma > 0),
                          metoda VARCHAR(20) NOT NULL CHECK (metoda IN ('numerar', 'card', 'transfer')),
                          data_plata TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE extras (
                        id SERIAL PRIMARY KEY,
                        nume VARCHAR(80) NOT NULL UNIQUE,
                        pret_pe_zi NUMERIC(8,2) NOT NULL CHECK (pret_pe_zi > 0)
);

CREATE TABLE rental_extras (
                               rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
                               extra_id INT NOT NULL REFERENCES extras(id) ON DELETE RESTRICT,
                               cantitate INT NOT NULL DEFAULT 1 CHECK (cantitate > 0),
                               PRIMARY KEY (rental_id, extra_id)
);
# Platforma de inchiriere auto

Aplicatie web pentru inchirierea de masini (un singur punct de lucru, Galati). Proiect individual, realizat cu PostgreSQL ca SGBD relational.

Descrierea domeniului si a paginilor: [docs/domeniu.md](docs/domeniu.md)

## Cerinte

- Docker Desktop (cu Docker Compose)
- Node.js (LTS) si Git

## Pornire

1. Cloneaza repository-ul si intra in folder:
   ```
   git clone https://github.com/StefanPodasca/car-rental.git
   cd car-rental
   ```
2. Creeaza fisierul `.env` pornind de la exemplu:
   ```
   copy .env.example .env      (Windows)
   cp .env.example .env        (Linux / Mac)
   ```
3. Porneste baza de date:
   ```
   docker compose up -d
   ```
   La prima pornire, scripturile din `db/init/` ruleaza automat: `01_schema.sql` creeaza tabelele, iar `02_fixtures.sql` introduce datele de test.

4. Verifica:
   ```
   docker exec -it car-rental-db psql -U carrental -d carrental -c "\dt"
   ```

Pentru a reface baza de date de la zero (stergere date + reincarcare fixtures):
```
docker compose down -v
docker compose up -d
```

## Conturi de test

Parola pentru toate conturile: `Parola123!`

| Rol | Email |
|---|---|
| admin | admin@carrental.ro |
| angajat | maria@carrental.ro |
| client | ioana@example.com |

## Model de date

8 tabele: `roles`, `users`, `categories`, `cars`, `rentals`, `payments`, `extras`, `rental_extras`.
Schema completa, cu relatii si constrangeri: [db/init/01_schema.sql](db/init/01_schema.sql).

## Stadiul proiectului

| Etapa | Continut | Stare |
|---|---|---|
| 0 | Tema, document domeniu | Gata |
| 1 | Modelare, fixtures | Gata |
| 2 | CRUD, descrierea paginilor | In lucru |
| 3 | Autentificare, roluri | De facut |
| 4 | Indecsi, load test | De facut |
| 5 | Rapoarte | De facut |
| 6 | Sustinere | De facut |
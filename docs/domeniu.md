# Platformă de închiriere auto – Documentație

Proiect individual, realizat cu un singur SGBD relațional (PostgreSQL).
Documentul se completează pe parcursul etapelor proiectului.

## 1. Domeniul temei

Aplicația modelează activitatea unei firme de închirieri auto cu un singur punct de lucru, în Galați. Firma deține un parc de mașini, grupate pe categorii (economy, compact, SUV, premium, van). Clienții pot vedea mașinile disponibile, pot face rezervări pe o perioadă aleasă, pot adăuga opțiuni suplimentare (GPS, scaun pentru copii etc.) și pot plăti. Preluarea și returnarea mașinilor se fac la sediul din Galați. Angajații firmei gestionează predarea și returnarea mașinilor, iar administratorul gestionează întreaga platformă.

Problema rezolvată: înlocuirea evidenței pe hârtie sau în foi de calcul cu o platformă web care ține la zi disponibilitatea mașinilor, evită suprapunerea rezervărilor și oferă rapoarte despre activitatea firmei.

## 2. Actori și roluri

Aplicația are 3 roluri de bază, cu drepturi de acces diferite. Drepturile se aplică în Etapa 3 (autentificare).

| Rol | Ce poate face |
|---|---|
| **Client** | Își creează cont, vede catalogul de mașini, face rezervări, își vede și anulează propriile rezervări, își vede plățile. |
| **Angajat** | Vede toate rezervările, confirmă rezervări, înregistrează predarea și returnarea mașinii, înregistrează plăți, actualizează starea mașinilor. Nu gestionează utilizatori și nu vede rapoartele financiare. |
| **Admin** | Are acces complet: CRUD pe toate entitățile (utilizatori, mașini, categorii, opțiuni suplimentare, rezervări, plăți, roluri), atribuie roluri, generează rapoarte. |

Cele 3 roluri de bază sunt protejate: nu pot fi redenumite sau șterse. Administratorul poate crea roluri suplimentare, fără drepturi speciale până la configurarea lor.

## 3. Procesele principale

1. **Înregistrare și autentificare.** Utilizatorul își creează cont (parola se stochează hash-uită) și se autentifică. Rolul implicit este client.
2. **Căutare mașini.** Clientul alege perioada. Sunt afișate doar mașinile care nu au rezervări suprapuse în acea perioadă.
3. **Rezervare.** Clientul alege mașina, perioada și, opțional, opțiuni suplimentare. Sistemul calculează prețul total (zile × (preț mașină + opțiunile alese)). Rezervarea pornește în starea *în așteptare*.
4. **Confirmare.** Un angajat confirmă rezervarea (*confirmată*).
5. **Predare.** La preluare, la sediul din Galați, angajatul marchează rezervarea *activă*, iar mașina *închiriată*.
6. **Returnare.** La returnare, angajatul marchează rezervarea *finalizată*, iar mașina redevine *disponibilă*.
7. **Plată.** Pentru fiecare rezervare se înregistrează una sau mai multe plăți (numerar, card, transfer).
8. **Anulare.** Clientul poate anula o rezervare înainte de predare (*anulată*).
9. **Raportare.** Adminul generează rapoarte din date, exportabile în PDF, CSV sau Excel.

## 4. Datele păstrate (entități)

Modelul are 8 tabele. Schema completă este în `db/init/01_schema.sql`.

| Tabel | Descriere | Câmpuri principale |
|---|---|---|
| `roles` | Rolurile din aplicație | id, nume (unic, nevid) |
| `users` | Conturile utilizatorilor | id, nume, email (unic), parola_hash, telefon, role_id |
| `categories` | Categoriile de mașini | id, nume (unic), descriere |
| `cars` | Parcul auto | id, marcă, model, an, număr înmatriculare (unic), preț pe zi, stare, category_id |
| `rentals` | Rezervările / închirierile | id, user_id, car_id, data_start, data_end, stare, preț_total |
| `payments` | Plățile pentru rezervări | id, rental_id, sumă, metodă, dată |
| `extras` | Opțiuni suplimentare | id, nume (unic), preț pe zi |
| `rental_extras` | Opțiunile alese la o rezervare | rental_id, extra_id, cantitate |

### Relații

- un rol are mulți utilizatori (`roles` 1 – N `users`)
- o categorie are multe mașini (`categories` 1 – N `cars`)
- un utilizator are multe rezervări (`users` 1 – N `rentals`)
- o mașină apare în multe rezervări, în perioade diferite (`cars` 1 – N `rentals`)
- o rezervare are una sau mai multe plăți (`rentals` 1 – N `payments`)
- o rezervare poate avea mai multe opțiuni, iar o opțiune apare în mai multe rezervări (`rentals` N – N `extras`, prin `rental_extras`)

### Constrângeri

- `users.email`, `cars.numar_inmatriculare`, `categories.nume`, `extras.nume` și `roles.nume` sunt unice
- `cars.pret_pe_zi > 0`, `extras.pret_pe_zi > 0` și `payments.suma > 0`
- `rental_extras.cantitate > 0`
- `rentals.data_end > rentals.data_start`
- cheie primară compusă `(rental_id, extra_id)` în `rental_extras`
- stările (mașină, rezervare) și metodele de plată sunt limitate la valori permise
- numele rolului nu poate fi gol
- chei străine pe toate relațiile: `ON DELETE RESTRICT` pentru entitățile de referință (o mașină, o categorie, un utilizator sau un rol folosite nu pot fi șterse) și `ON DELETE CASCADE` pentru datele dependente (plățile și opțiunile unei rezervări șterse)
- constrângere `EXCLUDE` cu `daterange` (extensia `btree_gist`): aceeași mașină nu poate avea două rezervări neanulate cu perioade suprapuse

## 5. Reguli de business

- O mașină nu poate fi rezervată pentru perioade care se suprapun; rezervările anulate nu blochează mașina.
- Prețul total se calculează automat la salvarea rezervării: numărul de zile × (prețul mașinii + prețul opțiunilor × cantitate). La editare se recalculează.
- Rezervarea și opțiunile ei se salvează într-o tranzacție: ori se salvează complet, ori deloc.
- Suma plăților unei rezervări nu poate depăși prețul total; verificarea se face într-o tranzacție, cu rezervarea blocată.
- Parola are minimum 8 caractere și se stochează hash-uită cu bcrypt. La editarea unui utilizator, parola se schimbă doar dacă este completată.
- Rolurile de bază (client, angajat, admin) nu pot fi modificate sau șterse.
- O rezervare poate fi anulată doar dacă nu a fost predată.
- Un client vede doar propriile rezervări și plăți (se aplică în Etapa 3).
- Preluarea și returnarea se fac la sediul din Galați.

## 6. Pagini din interfață

Toate paginile au în partea de sus un meniu de navigare comun: **Mașini | Categorii | Opțiuni | Utilizatori | Rezervări | Plăți | Roluri**. Pentru fiecare entitate există aceeași structură de pagini: lista (`/entitate`), formularul de adăugare (`/entitate/new`) și formularul de editare (`/entitate/:id/edit`). Ștergerea se face din listă, cu confirmare. Erorile (valori invalide, duplicate, încălcări de constrângeri) sunt afișate în roșu, în aceeași pagină, iar datele introduse rămân în formular.

Accesul pe roluri (coloana „Acces”) este cel planificat; se aplică efectiv în Etapa 3.

### 6.1 Mașini – `/cars`

- **Scop:** gestionarea parcului auto.
- **Date afișate:** ID, marcă, model, an, număr de înmatriculare, categorie, preț pe zi, stare (disponibilă / închiriată / service).
- **Acțiuni:** adăugare, editare, ștergere. În formular, categoria și starea se aleg din liste.
- **Validări:** numărul de înmatriculare este unic; anul între 2000 și 2100; prețul pozitiv. O mașină care are rezervări nu poate fi ștearsă.
- **Acces:** vizualizare pentru toți; modificări pentru admin (starea și pentru angajat).

### 6.2 Categorii – `/categories`

- **Scop:** gestionarea categoriilor de mașini.
- **Date afișate:** ID, nume, descriere, numărul de mașini din categorie.
- **Acțiuni:** adăugare, editare, ștergere.
- **Validări:** numele este unic (maxim 50 de caractere). O categorie care conține mașini nu poate fi ștearsă.
- **Acces:** admin.

### 6.3 Opțiuni suplimentare – `/extras`

- **Scop:** gestionarea opțiunilor care se pot adăuga la o rezervare (GPS, scaun copil, asigurare completă, șofer suplimentar).
- **Date afișate:** ID, nume, preț pe zi, numărul de rezervări în care e folosită opțiunea.
- **Acțiuni:** adăugare, editare, ștergere.
- **Validări:** numele este unic; prețul este pozitiv. O opțiune folosită într-o rezervare nu poate fi ștearsă.
- **Acces:** admin.

### 6.4 Utilizatori – `/users`

- **Scop:** gestionarea conturilor.
- **Date afișate:** ID, nume, email, telefon, rol, data creării. Parola nu este afișată niciodată.
- **Acțiuni:** adăugare, editare, ștergere. Rolul se alege dintr-o listă. La editare, câmpul pentru parolă se lasă gol pentru a păstra parola actuală.
- **Validări:** email unic; parola de minimum 8 caractere, stocată hash-uită (bcrypt). Un utilizator care are rezervări nu poate fi șters.
- **Acces:** admin.

### 6.5 Rezervări – `/rentals`

- **Scop:** gestionarea rezervărilor.
- **Date afișate:** ID, client, mașină (cu număr de înmatriculare), perioada, stare (în așteptare / confirmată / activă / finalizată / anulată), opțiunile alese cu cantitatea, prețul total, suma plătită.
- **Acțiuni:** adăugare, editare, ștergere. În formular se aleg clientul, mașina, perioada, starea și opțiunile suplimentare (bifare + cantitate). Prețul total se calculează automat și nu se introduce manual.
- **Validări:** data de sfârșit trebuie să fie după cea de început; mașina nu poate fi rezervată în perioade suprapuse (baza de date refuză rezervarea). Ștergerea unei rezervări șterge și plățile și opțiunile ei.
- **Acces:** client (doar propriile rezervări, adăugare și anulare), angajat (toate, confirmare / predare / returnare), admin (toate).

### 6.6 Plăți – `/payments`

- **Scop:** înregistrarea plăților pentru rezervări.
- **Date afișate:** ID, rezervarea, clientul, mașina, suma, metoda (numerar / card / transfer), data plății.
- **Acțiuni:** adăugare, editare, ștergere. În formular, fiecare rezervare din listă arată prețul total și suma deja plătită.
- **Validări:** suma este pozitivă; suma plăților unei rezervări nu poate depăși prețul total (mesajul indică suma rămasă de plată).
- **Acces:** angajat și admin; clientul își vede doar propriile plăți.

### 6.7 Roluri – `/roles`

- **Scop:** gestionarea rolurilor.
- **Date afișate:** ID, nume, numărul de utilizatori cu rolul respectiv. Rolurile de bază sunt marcate „rol de bază” și nu au butoane de editare sau ștergere.
- **Acțiuni:** adăugare, editare, ștergere pentru rolurile noi (numele se salvează cu litere mici).
- **Validări:** numele este unic și nevid (maxim 20 de caractere). Un rol cu utilizatori nu poate fi șters; rolurile de bază nu pot fi modificate.
- **Acces:** admin.

### 6.8 Pagini planificate

| Pagină | Etapa | Rol | Scop |
|---|---|---|---|
| Login / Înregistrare | 3 | toți | Autentificare și creare cont |
| Catalog mașini disponibile | 3 | toți | Filtrarea mașinilor pe perioadă și categorie |
| Rezervările mele | 3 | client | Vizualizarea și anularea rezervărilor proprii |
| Rapoarte | 5 | admin | Generare și export PDF / CSV / Excel |

## 7. Stadiul cerințelor

| # | Cerință | Etapa | Stare |
|---|---|---|---|
| 1 | Documentație (domeniu + pagini) | 0, 2 | Domeniul și paginile din Etapa 2 sunt descrise; se completează la etapele următoare |
| 2 | Model de date (minimum 6 tabele, relații, constrângeri) | 1 | Gata (8 tabele) |
| 3 | Fixtures (date de test la pornirea serviciului) | 1 | Gata |
| 4 | Operații CRUD pentru toate entitățile | 2 | Gata (toate cele 8 tabele; `rental_extras` se gestionează din formularul rezervării) |
| 5 | Autentificare (parole, sesiuni sau tokenuri) | 3 | De realizat (parolele sunt deja hash-uite cu bcrypt) |
| 6 | Roluri (minimum 3, drepturi diferite) | 3 | Roluri definite și gestionabile; drepturile se aplică în Etapa 3 |
| 7 | Indecși, justificați prin planuri de execuție înainte/după | 4 | De realizat |
| 8 | Load test cu rezultate măsurate | 4 | De realizat |
| 9 | Rapoarte în PDF, CSV sau Excel | 5 | De realizat |
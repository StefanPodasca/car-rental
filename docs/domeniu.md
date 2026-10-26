# Platformă de închiriere auto – Documentație

Proiect individual, realizat cu un singur SGBD relațional (PostgreSQL).
Documentul se completează pe parcursul etapelor proiectului.

## 1. Domeniul temei

Aplicația modelează activitatea unei firme de închirieri auto cu un singur punct de lucru, în Galați. Firma deține un parc de mașini, grupate pe categorii (economy, compact, SUV, premium, van). Clienții pot vedea mașinile disponibile, pot face rezervări pe o perioadă aleasă, pot adăuga opțiuni suplimentare (GPS, scaun pentru copii etc.) și pot plăti. Preluarea și returnarea mașinilor se fac la sediul din Galați. Angajații firmei gestionează predarea și returnarea mașinilor, iar administratorul gestionează întreaga platformă.

Problema rezolvată: înlocuirea evidenței pe hârtie sau în foi de calcul cu o platformă web care ține la zi disponibilitatea mașinilor, evită suprapunerea rezervărilor și oferă rapoarte despre activitatea firmei.

## 2. Actori și roluri

Aplicația are 3 roluri, cu drepturi de acces diferite.

| Rol | Ce poate face |
|---|---|
| **Client** | Își creează cont, vede catalogul de mașini, face rezervări, își vede și anulează propriile rezervări, își vede plățile. |
| **Angajat** | Vede toate rezervările, confirmă rezervări, înregistrează predarea și returnarea mașinii, înregistrează plăți, actualizează starea mașinilor. Nu gestionează utilizatori și nu vede rapoartele financiare. |
| **Admin** | Are acces complet: CRUD pe toate entitățile (utilizatori, mașini, categorii, opțiuni suplimentare, rezervări, plăți), atribuie roluri, generează rapoarte. |

## 3. Procesele principale

1. **Înregistrare și autentificare.** Utilizatorul își creează cont (parola se stochează hash-uită) și se autentifică. Rolul implicit este client.
2. **Căutare mașini.** Clientul alege perioada. Sunt afișate doar mașinile care nu au rezervări suprapuse în acea perioadă.
3. **Rezervare.** Clientul alege mașina, perioada și, opțional, opțiuni suplimentare. Sistemul calculează prețul total (preț pe zi × număr de zile + opțiunile alese). Rezervarea pornește în starea *în așteptare*.
4. **Confirmare.** Un angajat confirmă rezervarea (*confirmată*).
5. **Predare.** La preluare, la sediul din Galați, angajatul marchează rezervarea *activă*, iar mașina *închiriată*.
6. **Returnare.** La returnare, angajatul marchează rezervarea *finalizată*, iar mașina redevine *disponibilă*.
7. **Plată.** Pentru fiecare rezervare se înregistrează una sau mai multe plăți (numerar, card, transfer).
8. **Anulare.** Clientul poate anula o rezervare înainte de predare (*anulată*).
9. **Raportare.** Adminul generează rapoarte din date, exportabile în PDF, CSV sau Excel.

## 4. Datele păstrate (entități)

Modelul are 8 tabele. Structura exactă (tipuri, constrângeri, indecși) se detaliază în Etapa 1.

| Tabel | Descriere | Câmpuri principale |
|---|---|---|
| `roles` | Rolurile din aplicație | id, nume (client / angajat / admin) |
| `users` | Conturile utilizatorilor | id, nume, email (unic), parola_hash, telefon, role_id |
| `categories` | Categoriile de mașini | id, nume, descriere |
| `cars` | Parcul auto | id, marcă, model, an, număr înmatriculare (unic), preț pe zi, stare, category_id |
| `rentals` | Rezervările / închirierile | id, user_id, car_id, data_start, data_end, stare, preț_total |
| `payments` | Plățile pentru rezervări | id, rental_id, sumă, metodă, dată |
| `extras` | Opțiuni suplimentare | id, nume, preț pe zi |
| `rental_extras` | Opțiunile alese la o rezervare | rental_id, extra_id, cantitate |

### Relații

- un rol are mulți utilizatori (`roles` 1 – N `users`)
- o categorie are multe mașini (`categories` 1 – N `cars`)
- un utilizator are multe rezervări (`users` 1 – N `rentals`)
- o mașină apare în multe rezervări, în perioade diferite (`cars` 1 – N `rentals`)
- o rezervare are una sau mai multe plăți (`rentals` 1 – N `payments`)
- o rezervare poate avea mai multe opțiuni, iar o opțiune apare în mai multe rezervări (`rentals` N – N `extras`, prin `rental_extras`)

### Constrângeri prevăzute

- `users.email` și `cars.numar_inmatriculare` sunt unice
- `cars.pret_pe_zi > 0`, `extras.pret_pe_zi > 0` și `payments.suma > 0`
- `rental_extras.cantitate > 0`
- `rentals.data_end > rentals.data_start`
- cheie primară compusă `(rental_id, extra_id)` în `rental_extras`
- stările (mașină, rezervare, metodă de plată) sunt limitate la valori permise
- chei străine pe toate relațiile, cu comportament definit la ștergere
- nu se permit rezervări suprapuse pentru aceeași mașină

## 5. Reguli de business

- O mașină nu poate fi rezervată pentru perioade care se suprapun.
- Prețul total se calculează la rezervare și se păstrează în rezervare.
- O rezervare poate fi anulată doar dacă nu a fost predată.
- Un client vede doar propriile rezervări și plăți.
- Suma plăților nu poate depăși prețul total.
- Preluarea și returnarea se fac la sediul din Galați.

## 6. Pagini din interfață

Lista paginilor și descrierea fiecăreia (scop, date afișate, acțiuni, roluri cu acces) se completează în Etapa 2, odată cu implementarea operațiilor CRUD.

| Pagină | Rol | Scop |
|---|---|---|
| Login / Înregistrare | toți | Autentificare și creare cont |
| Catalog mașini | toți | Listarea și filtrarea mașinilor disponibile |
| Detalii mașină + rezervare | client | Alegerea perioadei, a opțiunilor și crearea rezervării |
| Rezervările mele | client | Vizualizarea și anularea rezervărilor proprii |
| Rezervări (gestiune) | angajat, admin | Confirmare, predare, returnare |
| Plăți | angajat, admin | Înregistrarea și vizualizarea plăților |
| Gestiune mașini | admin | CRUD mașini |
| Gestiune categorii | admin | CRUD categorii |
| Gestiune opțiuni suplimentare | admin | CRUD opțiuni |
| Gestiune utilizatori | admin | CRUD utilizatori, atribuire roluri |
| Rapoarte | admin | Generare și export PDF / CSV / Excel |

## 7. Stadiul cerințelor

| # | Cerință | Etapa | Stare |
|---|---|---|---|
| 1 | Documentație (domeniu + pagini) | 0, 2 | Domeniul descris, paginile se detaliază în Etapa 2 |
| 2 | Model de date (minimum 6 tabele, relații, constrângeri) | 1 | Planificat (8 tabele) |
| 3 | Fixtures (date de test la pornirea serviciului) | 1 | De realizat |
| 4 | Operații CRUD pentru toate entitățile | 2 | De realizat |
| 5 | Autentificare (parole, sesiuni sau tokenuri) | 3 | De realizat |
| 6 | Roluri (minimum 3, drepturi diferite) | 3 | Definite (client, angajat, admin) |
| 7 | Indecși, justificați prin planuri de execuție înainte/după | 4 | De realizat |
| 8 | Load test cu rezultate măsurate | 4 | De realizat |
| 9 | Rapoarte în PDF, CSV sau Excel | 5 | De realizat |
# Platformă de închiriere auto – Documentație

Proiect individual, realizat cu un singur SGBD relațional (PostgreSQL).
Documentul se completează pe parcursul etapelor proiectului.

## 1. Domeniul temei

Aplicația modelează activitatea unei firme de închirieri auto cu un singur punct de lucru, în Galați. Firma deține un parc de mașini, grupate pe categorii (economy, compact, SUV, premium, van). Clienții pot vedea mașinile disponibile, pot face rezervări pe o perioadă aleasă, pot adăuga opțiuni suplimentare (GPS, scaun pentru copii etc.) și pot plăti. Preluarea și returnarea mașinilor se fac la sediul din Galați. Angajații firmei gestionează predarea și returnarea mașinilor, iar administratorul gestionează întreaga platformă.

Problema rezolvată: înlocuirea evidenței pe hârtie sau în foi de calcul cu o platformă web care ține la zi disponibilitatea mașinilor, evită suprapunerea rezervărilor și oferă rapoarte despre activitatea firmei.

## 2. Actori și roluri

Aplicația are 3 roluri de bază, cu drepturi de acces diferite (detaliate în secțiunea 6).

| Rol | Ce poate face |
|---|---|
| **Client** | Își creează cont, vede catalogul de mașini, face rezervări, își vede și anulează propriile rezervări. |
| **Angajat** | Vede și editează toate rezervările, mașinile și plățile (confirmă rezervări, înregistrează predarea și returnarea, înregistrează plăți). Nu gestionează utilizatori, categorii, opțiuni sau roluri și nu poate șterge date. |
| **Admin** | Are acces complet: CRUD pe toate entitățile (utilizatori, mașini, categorii, opțiuni suplimentare, rezervări, plăți, roluri), singurul care poate șterge, generează rapoarte. |

Cele 3 roluri de bază sunt protejate: nu pot fi redenumite sau șterse. Administratorul poate crea roluri suplimentare, care nu au drepturi speciale (văd doar catalogul public).

## 3. Procesele principale

1. **Înregistrare și autentificare.** Utilizatorul își creează cont (parola se stochează hash-uită) și se autentifică. Contul nou are rolul client.
2. **Căutare mașini.** Oricine (și vizitatorul neautentificat) alege perioada și categoria în catalog. Sunt afișate doar mașinile care nu au rezervări suprapuse în acea perioadă.
3. **Rezervare.** Clientul autentificat alege mașina din catalog, confirmă perioada și, opțional, opțiuni suplimentare. Sistemul calculează prețul total (zile × (preț mașină + opțiunile alese)). Rezervarea pornește în starea *în așteptare*. Angajatul poate crea rezervări și în numele unui client.
4. **Confirmare.** Un angajat confirmă rezervarea (*confirmată*).
5. **Predare.** La preluare, la sediul din Galați, angajatul marchează rezervarea *activă*, iar mașina *închiriată*.
6. **Returnare.** La returnare, angajatul marchează rezervarea *finalizată*, iar mașina redevine *disponibilă*.
7. **Plată.** Pentru fiecare rezervare se înregistrează una sau mai multe plăți (numerar, card, transfer).
8. **Anulare.** Clientul poate anula o rezervare înainte de predare (*anulată*).
9. **Raportare.** Adminul generează rapoarte din date, exportabile în PDF, CSV sau Excel.

## 4. Datele păstrate (entități)

Modelul are 8 tabele. Schema completă este în `db/init/01_schema.sql`. În plus, biblioteca de sesiuni creează automat tabela tehnică `session` (sesiunile active), care nu face parte din modelul de date al domeniului.

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
- Prețul total se calculează automat pe server la salvarea rezervării: numărul de zile × (prețul mașinii + prețul opțiunilor × cantitate). La editare se recalculează.
- Rezervarea și opțiunile ei se salvează într-o tranzacție: ori se salvează complet, ori deloc.
- Suma plăților unei rezervări nu poate depăși prețul total; verificarea se face într-o tranzacție, cu rezervarea blocată.
- Un client poate rezerva doar mașini care nu sunt în service, doar începând de azi, și doar în numele lui.
- Un client își poate anula rezervările doar cât timp sunt în starea *în așteptare* sau *confirmată*.
- Un client vede doar propriile rezervări și suma plătită pentru ele.
- Parola are minimum 8 caractere și se stochează hash-uită cu bcrypt. La editarea unui utilizator, parola se schimbă doar dacă este completată.
- Rolurile de bază (client, angajat, admin) nu pot fi modificate sau șterse.
- Orice ștergere este permisă doar administratorului.
- Preluarea și returnarea se fac la sediul din Galați.

## 6. Autentificare și autorizare

### 6.1 Stocarea parolelor

Parolele nu sunt păstrate niciodată în clar. La crearea unui cont (înregistrare sau adăugare de către admin), aplicația calculează hash-ul parolei cu algoritmul **bcrypt** (biblioteca `bcryptjs`, cost 10) și salvează doar hash-ul, în coloana `users.parola_hash`. bcrypt adaugă automat o „sare” aleatoare, deci două utilizatori cu aceeași parolă au hash-uri diferite, iar hash-ul nu poate fi inversat. Parolele din datele de test (fixtures) sunt hash-uite la fel, direct în baza de date, cu extensia `pgcrypto`, deci conturile de test se pot autentifica.

### 6.2 Autentificarea (login)

1. Utilizatorul trimite emailul și parola din formularul `/login`.
2. Aplicația caută utilizatorul după email (fără a ține cont de litere mari/mici) și compară parola introdusă cu hash-ul din baza de date, cu `bcrypt.compare`.
3. Dacă emailul nu există sau parola e greșită, mesajul este același („Email sau parola incorecte”), ca să nu se poată afla ce emailuri au cont. Pentru același motiv, când emailul nu există, aplicația compară oricum parola cu un hash fals, ca timpul de răspuns să fie asemănător.
4. Dacă datele sunt corecte, se creează o sesiune nouă.

### 6.3 Sesiunile

Aplicația folosește **sesiuni pe server** (`express-session`):

- după login, serverul reține în sesiune doar `id`, `nume`, `email` și `rol` ale utilizatorului (niciodată parola sau hash-ul);
- browserul primește doar un cookie (`connect.sid`) cu identificatorul sesiunii, semnat cu o cheie secretă (`SESSION_SECRET`, păstrată în `.env`, nu în repository);
- cookie-ul este `HttpOnly` (nu poate fi citit din JavaScript), `SameSite=Lax` (nu se trimite la cereri POST venite de pe alte site-uri) și expiră după 8 ore;
- sesiunile se stochează în **PostgreSQL** (biblioteca `connect-pg-simple`, tabela `session`), deci nu se pierd când serverul repornește;
- identificatorul sesiunii se **regenerează** la login, ca să nu poată fi fixat dinainte de un atacator (*session fixation*);
- la `Iesire` (logout) sesiunea este ștearsă din baza de date, iar cookie-ul este eliminat.

### 6.4 Înregistrarea

Formularul `/register` creează conturi doar cu rolul **client** (rolul este setat de server, nu ales de utilizator). Parola trebuie să aibă minimum 8 caractere și să fie repetată identic. Emailul este unic. După creare, utilizatorul este autentificat direct.

### 6.5 Autorizarea pe roluri

Pentru fiecare cerere, un middleware (`requireRole`) verifică în server rolul din sesiune:

- utilizator neautentificat → este trimis la `/login`;
- utilizator autentificat, dar fără dreptul necesar → pagina **403 – Acces interzis**.

Verificarea se face în server, nu doar prin ascunderea linkurilor din meniu, deci un URL scris direct în browser este refuzat în același fel.

| Zonă | Vizitator | Client | Angajat | Admin |
|---|---|---|---|---|
| Catalog (`/catalog`) | da | da | da | da |
| Rezervările mele (`/my-rentals`) | nu | da (doar ale lui) | nu | nu |
| Mașini, Rezervări, Plăți (adăugare și editare) | nu | nu | da | da |
| Categorii, Opțiuni, Utilizatori, Roluri | nu | nu | nu | da |
| Orice ștergere | nu | nu | nu | da |

Meniul de navigare afișează doar linkurile la care rolul are acces, iar butoanele „Șterge” apar doar pentru admin. Un client nu poate vedea sau anula rezervările altcuiva: interogările din „Rezervările mele” filtrează după identificatorul utilizatorului din sesiune.

### 6.6 Conturi de test

Toate au parola `Parola123!`.

| Rol | Email |
|---|---|
| admin | admin@carrental.ro |
| angajat | maria@carrental.ro |
| client | ioana@example.com |

### 6.7 Limitări cunoscute

- Formularele nu au token CSRF; protecția de bază este cookie-ul `SameSite=Lax`.
- Cookie-ul nu are indicatorul `Secure`, pentru că aplicația rulează local, fără HTTPS. Într-un mediu real, ar trebui activat.
- Nu există limitare a numărului de încercări de login.

## 7. Pagini din interfață

Toate paginile au în partea de sus un meniu de navigare, care arată doar linkurile accesibile rolului curent. Pentru fiecare entitate de gestiune există aceeași structură: lista (`/entitate`), formularul de adăugare (`/entitate/new`) și formularul de editare (`/entitate/:id/edit`). Ștergerea se face din listă, cu confirmare, și doar de către admin. Erorile (valori invalide, duplicate, încălcări de constrângeri) sunt afișate în roșu, în aceeași pagină, iar datele introduse rămân în formular.

### 7.1 Autentificare – `/login` și `/register`

- **Scop:** autentificarea și crearea contului de client.
- **Acțiuni:** login, înregistrare, logout (butonul „Ieșire” din meniu).
- **Validări:** vezi secțiunea 6.
- **Acces:** vizitatori (utilizatorul deja autentificat este redirecționat).

### 7.2 Catalog – `/catalog`

- **Scop:** căutarea mașinilor libere, pentru oricine.
- **Date afișate:** marcă, model, an, categorie, preț pe zi; după alegerea perioadei, și prețul estimat.
- **Acțiuni:** filtrare după perioadă și categorie; link „Rezervă” către formularul de rezervare (pentru vizitatori și clienți; vizitatorul este trimis la login).
- **Validări:** datele trebuie să fie valide, iar data de sfârșit după cea de început. Mașinile în service și cele cu rezervări suprapuse nu sunt afișate.
- **Acces:** toți.

### 7.3 Rezervările mele – `/my-rentals`

- **Scop:** clientul își vede și își gestionează rezervările.
- **Date afișate:** mașina, perioada, starea, opțiunile, prețul total, suma plătită.
- **Acțiuni:** formular de rezervare nouă (`/my-rentals/new`, cu opțiuni suplimentare; prețul se calculează automat) și anularea rezervărilor în așteptare sau confirmate.
- **Validări:** perioada nu poate începe în trecut; mașina nu poate fi rezervată în perioade suprapuse; mașina nu poate fi în service.
- **Acces:** client, doar propriile rezervări.

### 7.4 Acces interzis – 403

Pagina afișată când utilizatorul nu are dreptul să acceseze un URL.

### 7.5 Mașini – `/cars`

- **Scop:** gestionarea parcului auto.
- **Date afișate:** ID, marcă, model, an, număr de înmatriculare, categorie, preț pe zi, stare (disponibilă / închiriată / service).
- **Acțiuni:** adăugare, editare, ștergere. În formular, categoria și starea se aleg din liste.
- **Validări:** numărul de înmatriculare este unic; anul între 2000 și 2100; prețul pozitiv. O mașină care are rezervări nu poate fi ștearsă.
- **Acces:** angajat și admin; ștergerea doar admin.

### 7.6 Categorii – `/categories`

- **Scop:** gestionarea categoriilor de mașini.
- **Date afișate:** ID, nume, descriere, numărul de mașini din categorie.
- **Acțiuni:** adăugare, editare, ștergere.
- **Validări:** numele este unic (maxim 50 de caractere). O categorie care conține mașini nu poate fi ștearsă.
- **Acces:** admin.

### 7.7 Opțiuni suplimentare – `/extras`

- **Scop:** gestionarea opțiunilor care se pot adăuga la o rezervare (GPS, scaun copil, asigurare completă, șofer suplimentar).
- **Date afișate:** ID, nume, preț pe zi, numărul de rezervări în care e folosită opțiunea.
- **Acțiuni:** adăugare, editare, ștergere.
- **Validări:** numele este unic; prețul este pozitiv. O opțiune folosită într-o rezervare nu poate fi ștearsă.
- **Acces:** admin.

### 7.8 Utilizatori – `/users`

- **Scop:** gestionarea conturilor.
- **Date afișate:** ID, nume, email, telefon, rol, data creării. Parola nu este afișată niciodată.
- **Acțiuni:** adăugare, editare, ștergere. Rolul se alege dintr-o listă. La editare, câmpul pentru parolă se lasă gol pentru a păstra parola actuală.
- **Validări:** email unic; parola de minimum 8 caractere, stocată hash-uită. Un utilizator care are rezervări nu poate fi șters.
- **Acces:** admin.

### 7.9 Rezervări – `/rentals`

- **Scop:** gestionarea tuturor rezervărilor.
- **Date afișate:** ID, client, mașină (cu număr de înmatriculare), perioada, stare (în așteptare / confirmată / activă / finalizată / anulată), opțiunile alese cu cantitatea, prețul total, suma plătită.
- **Acțiuni:** adăugare, editare, ștergere. În formular se aleg clientul, mașina, perioada, starea și opțiunile suplimentare (bifare + cantitate). Prețul total se calculează automat și nu se introduce manual.
- **Validări:** data de sfârșit trebuie să fie după cea de început; mașina nu poate fi rezervată în perioade suprapuse (baza de date refuză rezervarea). Ștergerea unei rezervări șterge și plățile și opțiunile ei.
- **Acces:** angajat și admin; ștergerea doar admin.

### 7.10 Plăți – `/payments`

- **Scop:** înregistrarea plăților pentru rezervări.
- **Date afișate:** ID, rezervarea, clientul, mașina, suma, metoda (numerar / card / transfer), data plății.
- **Acțiuni:** adăugare, editare, ștergere. În formular, fiecare rezervare din listă arată prețul total și suma deja plătită.
- **Validări:** suma este pozitivă; suma plăților unei rezervări nu poate depăși prețul total (mesajul indică suma rămasă de plată).
- **Acces:** angajat și admin; ștergerea doar admin.

### 7.11 Roluri – `/roles`

- **Scop:** gestionarea rolurilor.
- **Date afișate:** ID, nume, numărul de utilizatori cu rolul respectiv. Rolurile de bază sunt marcate „rol de bază” și nu au butoane de editare sau ștergere.
- **Acțiuni:** adăugare, editare, ștergere pentru rolurile noi (numele se salvează cu litere mici).
- **Validări:** numele este unic și nevid (maxim 20 de caractere). Un rol cu utilizatori nu poate fi șters; rolurile de bază nu pot fi modificate.
- **Acces:** admin.

### 7.12 Pagini planificate

| Pagină | Etapa | Rol | Scop |
|---|---|---|---|
| Rapoarte | 5 | admin | Generare și export PDF / CSV / Excel |

## 8. Stadiul cerințelor

| # | Cerință | Etapa | Stare |
|---|---|---|---|
| 1 | Documentație (domeniu + pagini) | 0, 2 | Domeniul, paginile și autentificarea sunt descrise; se completează la etapele următoare |
| 2 | Model de date (minimum 6 tabele, relații, constrângeri) | 1 | Gata (8 tabele) |
| 3 | Fixtures (date de test la pornirea serviciului) | 1 | Gata |
| 4 | Operații CRUD pentru toate entitățile | 2 | Gata (toate cele 8 tabele; `rental_extras` se gestionează din formularul rezervării) |
| 5 | Autentificare (parole, sesiuni sau tokenuri) | 3 | Gata (bcrypt, sesiuni în PostgreSQL; vezi secțiunea 6) |
| 6 | Roluri (minimum 3, drepturi diferite) | 3 | Gata (client, angajat, admin; vezi secțiunea 6.5) |
| 7 | Indecși, justificați prin planuri de execuție înainte/după | 4 | De realizat |
| 8 | Load test cu rezultate măsurate | 4 | De realizat |
| 9 | Rapoarte în PDF, CSV sau Excel | 5 | De realizat |
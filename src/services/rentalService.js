// logica comuna pentru rezervari: folosita de angajati (/rentals) si de clienti (/my-rentals)

// eroare cu mesaj destinat utilizatorului
function userError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
}

// transforma erorile PostgreSQL in mesaje clare
function friendlyError(err) {
    if (err.userMessage) return err.userMessage;
    switch (err.code) {
        case '23P01': return 'Masina este deja rezervata in perioada aleasa (rezervarile nu se pot suprapune).';
        case '23514': return 'Date invalide: verifica perioada si starea.';
        case '23503': return 'Clientul, masina sau optiunea aleasa nu exista.';
        case '22007':
        case '22008': return 'Data introdusa nu este valida.';
        case '23502':
        case '22P02': return 'Date lipsa sau invalide.';
        default: return null;
    }
}

// optiunile bifate in formular: { extra_id: cantitate }
function parseExtras(body) {
    const selected = {};
    [].concat(body.extras || []).forEach((id) => {
        if (!/^\d+$/.test(id)) return;
        const qty = parseInt(body[`qty_${id}`], 10);
        selected[id] = qty > 0 ? qty : 1;
    });
    return selected;
}

// pret total = zile * (pret masina + suma optiunilor * cantitate); se calculeaza pe server
async function computeTotal(client, body, selected) {
    const carResult = await client.query(
        'SELECT pret_pe_zi, ($3::date - $2::date) AS zile FROM cars WHERE id = $1',
        [body.car_id, body.data_start, body.data_end]
    );
    if (carResult.rowCount === 0) throw userError('Masina aleasa nu exista.');
    const { pret_pe_zi, zile } = carResult.rows[0];
    if (zile <= 0) throw userError('Data de sfarsit trebuie sa fie dupa data de inceput.');

    const ids = Object.keys(selected).map(Number);
    let perDay = parseFloat(pret_pe_zi);
    if (ids.length > 0) {
        const extrasResult = await client.query(
            'SELECT id, pret_pe_zi FROM extras WHERE id = ANY($1::int[])',
            [ids]
        );
        if (extrasResult.rowCount !== ids.length) throw userError('Una dintre optiunile alese nu exista.');
        extrasResult.rows.forEach((e) => {
            perDay += parseFloat(e.pret_pe_zi) * selected[e.id];
        });
    }
    return Math.round(perDay * zile * 100) / 100;
}

async function saveExtras(client, rentalId, selected) {
    for (const [extraId, qty] of Object.entries(selected)) {
        await client.query(
            'INSERT INTO rental_extras (rental_id, extra_id, cantitate) VALUES ($1, $2, $3)',
            [rentalId, extraId, qty]
        );
    }
}

module.exports = { userError, friendlyError, parseExtras, computeTotal, saveExtras };
const express = require('express');
const pool = require('../db');

const router = express.Router();
const STARI = ['in_asteptare', 'confirmata', 'activa', 'finalizata', 'anulata'];

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Rezervare inexistenta');
    next();
});

// eroare cu mesaj destinat utilizatorului
function userError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
}

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

// pret total = zile * (pret masina + suma optiunilor * cantitate)
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

async function loadRentals() {
    const result = await pool.query(
        `SELECT r.id, u.nume AS client,
            c.marca || ' ' || c.model || ' (' || c.numar_inmatriculare || ')' AS masina,
            to_char(r.data_start, 'YYYY-MM-DD') AS data_start,
            to_char(r.data_end, 'YYYY-MM-DD') AS data_end,
            r.stare, r.pret_total,
            COALESCE((SELECT sum(p.suma) FROM payments p WHERE p.rental_id = r.id), 0) AS platit,
            COALESCE((SELECT string_agg(e.nume || ' x' || re.cantitate, ', ' ORDER BY e.nume)
                      FROM rental_extras re JOIN extras e ON e.id = re.extra_id
                      WHERE re.rental_id = r.id), '') AS optiuni
     FROM rentals r
     JOIN users u ON u.id = r.user_id
     JOIN cars c ON c.id = r.car_id
     ORDER BY r.id`
    );
    return result.rows;
}

async function renderForm(res, { title, action, rental, selected, error }) {
    const users = await pool.query('SELECT id, nume, email FROM users ORDER BY nume');
    const cars = await pool.query(
        'SELECT id, marca, model, numar_inmatriculare, pret_pe_zi FROM cars ORDER BY marca, model'
    );
    const extras = await pool.query('SELECT id, nume, pret_pe_zi FROM extras ORDER BY nume');
    res.render('rentals/form', {
        title, action, rental, selected, error,
        users: users.rows, cars: cars.rows, extras: extras.rows, stari: STARI,
    });
}

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        res.render('rentals/list', { rentals: await loadRentals(), error: null });
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', async (req, res, next) => {
    try {
        await renderForm(res, {
            title: 'Adauga rezervare', action: '/rentals',
            rental: { stare: 'in_asteptare' }, selected: {}, error: null,
        });
    } catch (err) {
        next(err);
    }
});

// CREATE: salvare (tranzactie: rezervare + optiuni)
router.post('/', async (req, res, next) => {
    const selected = parseExtras(req.body);
    const form = { title: 'Adauga rezervare', action: '/rentals', rental: req.body, selected };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const total = await computeTotal(client, req.body, selected);
        const inserted = await client.query(
            `INSERT INTO rentals (user_id, car_id, data_start, data_end, stare, pret_total)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [req.body.user_id, req.body.car_id, req.body.data_start, req.body.data_end, req.body.stare, total]
        );
        await saveExtras(client, inserted.rows[0].id, selected);
        await client.query('COMMIT');
        res.redirect('/rentals');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, { ...form, error: message });
        } catch (e) {
            next(e);
        }
    } finally {
        client.release();
    }
});

// UPDATE: formular
router.get('/:id/edit', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, car_id, stare,
              to_char(data_start, 'YYYY-MM-DD') AS data_start,
              to_char(data_end, 'YYYY-MM-DD') AS data_end
       FROM rentals WHERE id = $1`,
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Rezervare inexistenta');
        const extrasResult = await pool.query(
            'SELECT extra_id, cantitate FROM rental_extras WHERE rental_id = $1',
            [req.params.id]
        );
        const selected = {};
        extrasResult.rows.forEach((row) => { selected[row.extra_id] = row.cantitate; });
        await renderForm(res, {
            title: 'Editeaza rezervarea', action: `/rentals/${req.params.id}`,
            rental: result.rows[0], selected, error: null,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare (pretul se recalculeaza)
router.post('/:id', async (req, res, next) => {
    const selected = parseExtras(req.body);
    const form = {
        title: 'Editeaza rezervarea', action: `/rentals/${req.params.id}`,
        rental: req.body, selected,
    };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const total = await computeTotal(client, req.body, selected);
        const updated = await client.query(
            `UPDATE rentals
       SET user_id = $1, car_id = $2, data_start = $3, data_end = $4, stare = $5, pret_total = $6
       WHERE id = $7`,
            [req.body.user_id, req.body.car_id, req.body.data_start, req.body.data_end,
                req.body.stare, total, req.params.id]
        );
        if (updated.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).send('Rezervare inexistenta');
        }
        await client.query('DELETE FROM rental_extras WHERE rental_id = $1', [req.params.id]);
        await saveExtras(client, req.params.id, selected);
        await client.query('COMMIT');
        res.redirect('/rentals');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, { ...form, error: message });
        } catch (e) {
            next(e);
        }
    } finally {
        client.release();
    }
});

// DELETE (optiunile si platile se sterg in cascada)
router.post('/:id/delete', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM rentals WHERE id = $1', [req.params.id]);
        res.redirect('/rentals');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
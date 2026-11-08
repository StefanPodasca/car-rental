const express = require('express');
const pool = require('../db');

const router = express.Router();
const METODE = ['numerar', 'card', 'transfer'];

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Plata inexistenta');
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
        case '23514': return 'Date invalide: suma trebuie sa fie pozitiva, iar metoda una dintre cele permise.';
        case '23503': return 'Rezervarea aleasa nu exista.';
        case '23502':
        case '22003':
        case '22P02': return 'Date lipsa sau invalide.';
        default: return null;
    }
}

// suma platilor unei rezervari nu poate depasi pretul total
// (paymentId = plata editata, exclusa din calcul; null la creare)
async function checkAmount(client, body, paymentId) {
    const rental = await client.query(
        'SELECT pret_total FROM rentals WHERE id = $1 FOR UPDATE',
        [body.rental_id]
    );
    if (rental.rowCount === 0) throw userError('Rezervarea aleasa nu exista.');

    const paid = await client.query(
        `SELECT COALESCE(sum(suma), 0) AS platit FROM payments
     WHERE rental_id = $1 AND ($2::int IS NULL OR id <> $2::int)`,
        [body.rental_id, paymentId]
    );

    const total = Math.round(parseFloat(rental.rows[0].pret_total) * 100);
    const already = Math.round(parseFloat(paid.rows[0].platit) * 100);
    const amount = Math.round(parseFloat(body.suma) * 100);

    if (!(amount > 0)) throw userError('Suma trebuie sa fie mai mare decat 0.');
    if (already + amount > total) {
        const left = ((total - already) / 100).toFixed(2);
        throw userError(`Suma depaseste pretul rezervarii. Mai ramas de plata: ${left} lei.`);
    }
}

async function loadPayments() {
    const result = await pool.query(
        `SELECT p.id, p.rental_id, u.nume AS client,
            c.marca || ' ' || c.model AS masina,
            p.suma, p.metoda,
            to_char(p.data_plata, 'YYYY-MM-DD HH24:MI') AS data_plata
     FROM payments p
     JOIN rentals r ON r.id = p.rental_id
     JOIN users u ON u.id = r.user_id
     JOIN cars c ON c.id = r.car_id
     ORDER BY p.id`
    );
    return result.rows;
}

async function renderForm(res, { title, action, payment, error }) {
    const rentals = await pool.query(
        `SELECT r.id, u.nume AS client, c.marca || ' ' || c.model AS masina, r.pret_total,
            COALESCE((SELECT sum(p.suma) FROM payments p WHERE p.rental_id = r.id), 0) AS platit
     FROM rentals r
     JOIN users u ON u.id = r.user_id
     JOIN cars c ON c.id = r.car_id
     ORDER BY r.id`
    );
    res.render('payments/form', { title, action, payment, error, rentals: rentals.rows, metode: METODE });
}

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        res.render('payments/list', { payments: await loadPayments(), error: null });
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', async (req, res, next) => {
    try {
        await renderForm(res, {
            title: 'Adauga plata', action: '/payments', payment: { metoda: 'card' }, error: null,
        });
    } catch (err) {
        next(err);
    }
});

// CREATE: salvare
router.post('/', async (req, res, next) => {
    const form = { title: 'Adauga plata', action: '/payments', payment: req.body };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await checkAmount(client, req.body, null);
        await client.query(
            'INSERT INTO payments (rental_id, suma, metoda) VALUES ($1, $2, $3)',
            [req.body.rental_id, req.body.suma, req.body.metoda]
        );
        await client.query('COMMIT');
        res.redirect('/payments');
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
            'SELECT id, rental_id, suma, metoda FROM payments WHERE id = $1',
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Plata inexistenta');
        await renderForm(res, {
            title: 'Editeaza plata', action: `/payments/${req.params.id}`,
            payment: result.rows[0], error: null,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare
router.post('/:id', async (req, res, next) => {
    const form = {
        title: 'Editeaza plata', action: `/payments/${req.params.id}`, payment: req.body,
    };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await checkAmount(client, req.body, req.params.id);
        const updated = await client.query(
            'UPDATE payments SET rental_id = $1, suma = $2, metoda = $3 WHERE id = $4',
            [req.body.rental_id, req.body.suma, req.body.metoda, req.params.id]
        );
        if (updated.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).send('Plata inexistenta');
        }
        await client.query('COMMIT');
        res.redirect('/payments');
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

// DELETE
router.post('/:id/delete', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
        res.redirect('/payments');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
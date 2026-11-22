const express = require('express');
const pool = require('../db');
const {
    userError, friendlyError, parseExtras, computeTotal, saveExtras,
} = require('../services/rentalService');

const router = express.Router();

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Rezervare inexistenta');
    next();
});

function today() {
    return new Date().toISOString().slice(0, 10);
}

// doar rezervarile clientului autentificat
async function loadMyRentals(userId) {
    const result = await pool.query(
        `SELECT r.id,
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
     WHERE r.user_id = $1
     ORDER BY r.data_start DESC, r.id DESC`,
        [userId]
    );
    return result.rows;
}

async function renderForm(res, { rental, selected, error }) {
    const extras = await pool.query('SELECT id, nume, pret_pe_zi FROM extras ORDER BY nume');
    let car = null;
    if (/^\d+$/.test(String(rental.car_id))) {
        const result = await pool.query(
            'SELECT id, marca, model, an, pret_pe_zi FROM cars WHERE id = $1',
            [rental.car_id]
        );
        car = result.rows[0] || null;
    }
    res.render('my-rentals/form', {
        rental, selected, error, car, extras: extras.rows, today: today(),
    });
}

// lista rezervarilor mele
router.get('/', async (req, res, next) => {
    try {
        res.render('my-rentals/list', {
            rentals: await loadMyRentals(req.session.user.id), error: null,
        });
    } catch (err) {
        next(err);
    }
});

// formular de rezervare (se ajunge din catalog)
router.get('/new', async (req, res, next) => {
    const { car_id, data_start = '', data_end = '' } = req.query;
    if (!/^\d+$/.test(car_id || '')) return res.redirect('/catalog');
    try {
        await renderForm(res, { rental: { car_id, data_start, data_end }, selected: {}, error: null });
    } catch (err) {
        next(err);
    }
});

// creare rezervare: clientul e cel autentificat, starea porneste "in_asteptare"
router.post('/', async (req, res, next) => {
    const selected = parseExtras(req.body);
    const rental = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (!rental.data_start || rental.data_start < today()) {
            throw userError('Data de inceput nu poate fi in trecut.');
        }
        const car = await client.query('SELECT stare FROM cars WHERE id = $1', [rental.car_id]);
        if (car.rowCount === 0) throw userError('Masina aleasa nu exista.');
        if (car.rows[0].stare === 'service') throw userError('Masina nu este disponibila pentru inchiriere.');

        const total = await computeTotal(client, rental, selected);
        const inserted = await client.query(
            `INSERT INTO rentals (user_id, car_id, data_start, data_end, stare, pret_total)
       VALUES ($1, $2, $3, $4, 'in_asteptare', $5) RETURNING id`,
            [req.session.user.id, rental.car_id, rental.data_start, rental.data_end, total]
        );
        await saveExtras(client, inserted.rows[0].id, selected);
        await client.query('COMMIT');
        res.redirect('/my-rentals');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, { rental, selected, error: message });
        } catch (e) {
            next(e);
        }
    } finally {
        client.release();
    }
});

// anulare: doar rezervarile proprii, inainte de predare
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE rentals SET stare = 'anulata'
       WHERE id = $1 AND user_id = $2 AND stare IN ('in_asteptare', 'confirmata')`,
            [req.params.id, req.session.user.id]
        );
        if (result.rowCount === 0) {
            return res.render('my-rentals/list', {
                rentals: await loadMyRentals(req.session.user.id),
                error: 'Rezervarea nu poate fi anulata: nu exista sau a fost deja predata.',
            });
        }
        res.redirect('/my-rentals');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
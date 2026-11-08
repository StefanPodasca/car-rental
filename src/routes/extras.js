const express = require('express');
const pool = require('../db');

const router = express.Router();

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Optiune inexistenta');
    next();
});

async function loadExtras() {
    const result = await pool.query(
        `SELECT e.id, e.nume, e.pret_pe_zi, count(re.rental_id)::int AS nr_rezervari
     FROM extras e
     LEFT JOIN rental_extras re ON re.extra_id = e.id
     GROUP BY e.id
     ORDER BY e.id`
    );
    return result.rows;
}

function friendlyError(err) {
    switch (err.code) {
        case '23505': return 'Exista deja o optiune cu acest nume.';
        case '23514': return 'Pretul trebuie sa fie mai mare decat 0.';
        case '23503': return 'Optiunea nu poate fi stearsa: este folosita in rezervari.';
        case '23502':
        case '22001':
        case '22003':
        case '22P02': return 'Date lipsa sau invalide.';
        default: return null;
    }
}

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        res.render('extras/list', { extras: await loadExtras(), error: null });
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', (req, res) => {
    res.render('extras/form', {
        title: 'Adauga optiune', action: '/extras', extra: {}, error: null,
    });
});

// CREATE: salvare
router.post('/', async (req, res, next) => {
    const { nume, pret_pe_zi } = req.body;
    try {
        await pool.query(
            'INSERT INTO extras (nume, pret_pe_zi) VALUES ($1, $2)',
            [nume, pret_pe_zi]
        );
        res.redirect('/extras');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        res.render('extras/form', {
            title: 'Adauga optiune', action: '/extras', extra: req.body, error: message,
        });
    }
});

// UPDATE: formular
router.get('/:id/edit', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM extras WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).send('Optiune inexistenta');
        res.render('extras/form', {
            title: 'Editeaza optiunea', action: `/extras/${req.params.id}`,
            extra: result.rows[0], error: null,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare
router.post('/:id', async (req, res, next) => {
    const { nume, pret_pe_zi } = req.body;
    try {
        const result = await pool.query(
            'UPDATE extras SET nume = $1, pret_pe_zi = $2 WHERE id = $3',
            [nume, pret_pe_zi, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Optiune inexistenta');
        res.redirect('/extras');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        res.render('extras/form', {
            title: 'Editeaza optiunea', action: `/extras/${req.params.id}`,
            extra: req.body, error: message,
        });
    }
});

// DELETE
router.post('/:id/delete', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM extras WHERE id = $1', [req.params.id]);
        res.redirect('/extras');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            res.render('extras/list', { extras: await loadExtras(), error: message });
        } catch (e) {
            next(e);
        }
    }
});

module.exports = router;
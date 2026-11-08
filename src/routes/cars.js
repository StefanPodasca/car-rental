const express = require('express');
const pool = require('../db');

const router = express.Router();
const STARI = ['disponibila', 'inchiriata', 'service'];

// id-ul din URL trebuie sa fie numar
router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Masina inexistenta');
    next();
});

async function loadCars() {
    const result = await pool.query(
        `SELECT c.id, c.marca, c.model, c.an, c.numar_inmatriculare,
            c.pret_pe_zi, c.stare, cat.nume AS categorie
     FROM cars c
     JOIN categories cat ON cat.id = c.category_id
     ORDER BY c.id`
    );
    return result.rows;
}

async function renderForm(res, { title, action, car, error }) {
    const categories = await pool.query('SELECT id, nume FROM categories ORDER BY nume');
    res.render('cars/form', {
        title, action, car, error,
        categories: categories.rows,
        stari: STARI,
    });
}

// transforma erorile PostgreSQL in mesaje clare pentru utilizator
function friendlyError(err) {
    switch (err.code) {
        case '23505': return 'Exista deja o masina cu acest numar de inmatriculare.';
        case '23514': return 'Valori invalide: verifica anul, pretul si starea.';
        case '23503': return 'Operatia nu este permisa: masina are rezervari sau categoria nu exista.';
        case '23502':
        case '22P02': return 'Date lipsa sau invalide.';
        default: return null;
    }
}

function carValues(body) {
    return [
        body.marca, body.model, body.an, body.numar_inmatriculare,
        body.pret_pe_zi, body.stare, body.category_id,
    ];
}

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        res.render('cars/list', { cars: await loadCars(), error: null });
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', async (req, res, next) => {
    try {
        await renderForm(res, {
            title: 'Adauga masina', action: '/cars',
            car: { stare: 'disponibila' }, error: null,
        });
    } catch (err) {
        next(err);
    }
});

// CREATE: salvare
router.post('/', async (req, res, next) => {
    try {
        await pool.query(
            `INSERT INTO cars (marca, model, an, numar_inmatriculare, pret_pe_zi, stare, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            carValues(req.body)
        );
        res.redirect('/cars');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, { title: 'Adauga masina', action: '/cars', car: req.body, error: message });
        } catch (e) {
            next(e);
        }
    }
});

// UPDATE: formular
router.get('/:id/edit', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM cars WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).send('Masina inexistenta');
        await renderForm(res, {
            title: 'Editeaza masina', action: `/cars/${req.params.id}`,
            car: result.rows[0], error: null,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare
router.post('/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE cars
       SET marca = $1, model = $2, an = $3, numar_inmatriculare = $4,
           pret_pe_zi = $5, stare = $6, category_id = $7
       WHERE id = $8`,
            [...carValues(req.body), req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Masina inexistenta');
        res.redirect('/cars');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, {
                title: 'Editeaza masina', action: `/cars/${req.params.id}`,
                car: req.body, error: message,
            });
        } catch (e) {
            next(e);
        }
    }
});

// DELETE
router.post('/:id/delete', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM cars WHERE id = $1', [req.params.id]);
        res.redirect('/cars');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            res.render('cars/list', { cars: await loadCars(), error: message });
        } catch (e) {
            next(e);
        }
    }
});

module.exports = router;
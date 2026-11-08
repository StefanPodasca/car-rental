const express = require('express');
const pool = require('../db');

const router = express.Router();

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Categorie inexistenta');
    next();
});

async function loadCategories() {
    const result = await pool.query(
        `SELECT cat.id, cat.nume, cat.descriere, count(c.id)::int AS nr_masini
     FROM categories cat
     LEFT JOIN cars c ON c.category_id = cat.id
     GROUP BY cat.id
     ORDER BY cat.id`
    );
    return result.rows;
}

function friendlyError(err) {
    switch (err.code) {
        case '23505': return 'Exista deja o categorie cu acest nume.';
        case '23503': return 'Categoria nu poate fi stearsa: exista masini in aceasta categorie.';
        case '23502':
        case '22001': return 'Date lipsa sau prea lungi (numele are maxim 50 de caractere).';
        default: return null;
    }
}

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        res.render('categories/list', { categories: await loadCategories(), error: null });
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', (req, res) => {
    res.render('categories/form', {
        title: 'Adauga categorie', action: '/categories', category: {}, error: null,
    });
});

// CREATE: salvare
router.post('/', async (req, res, next) => {
    const { nume, descriere } = req.body;
    try {
        await pool.query(
            'INSERT INTO categories (nume, descriere) VALUES ($1, $2)',
            [nume, descriere || null]
        );
        res.redirect('/categories');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        res.render('categories/form', {
            title: 'Adauga categorie', action: '/categories', category: req.body, error: message,
        });
    }
});

// UPDATE: formular
router.get('/:id/edit', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).send('Categorie inexistenta');
        res.render('categories/form', {
            title: 'Editeaza categoria', action: `/categories/${req.params.id}`,
            category: result.rows[0], error: null,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare
router.post('/:id', async (req, res, next) => {
    const { nume, descriere } = req.body;
    try {
        const result = await pool.query(
            'UPDATE categories SET nume = $1, descriere = $2 WHERE id = $3',
            [nume, descriere || null, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Categorie inexistenta');
        res.redirect('/categories');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        res.render('categories/form', {
            title: 'Editeaza categoria', action: `/categories/${req.params.id}`,
            category: req.body, error: message,
        });
    }
});

// DELETE
router.post('/:id/delete', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        res.redirect('/categories');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            res.render('categories/list', { categories: await loadCategories(), error: message });
        } catch (e) {
            next(e);
        }
    }
});

module.exports = router;
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;
const MIN_PASSWORD = 8;

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Utilizator inexistent');
    next();
});

async function loadUsers() {
    const result = await pool.query(
        `SELECT u.id, u.nume, u.email, u.telefon, r.nume AS rol,
            to_char(u.created_at, 'YYYY-MM-DD') AS data_creare
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
    );
    return result.rows;
}

async function renderForm(res, { title, action, user, error, isNew }) {
    const roles = await pool.query('SELECT id, nume FROM roles ORDER BY id');
    res.render('users/form', { title, action, user, error, isNew, roles: roles.rows });
}

function friendlyError(err) {
    switch (err.code) {
        case '23505': return 'Exista deja un utilizator cu acest email.';
        case '23503': return 'Operatia nu este permisa: utilizatorul are rezervari sau rolul nu exista.';
        case '23502':
        case '22001':
        case '22P02': return 'Date lipsa, invalide sau prea lungi.';
        default: return null;
    }
}

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        res.render('users/list', { users: await loadUsers(), error: null });
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', async (req, res, next) => {
    try {
        await renderForm(res, {
            title: 'Adauga utilizator', action: '/users', user: {}, error: null, isNew: true,
        });
    } catch (err) {
        next(err);
    }
});

// CREATE: salvare (parola se hash-uieste cu bcrypt)
router.post('/', async (req, res, next) => {
    const { nume, email, telefon, parola, role_id } = req.body;
    const form = { title: 'Adauga utilizator', action: '/users', user: req.body, isNew: true };
    try {
        if (!parola || parola.length < MIN_PASSWORD) {
            return await renderForm(res, { ...form, error: `Parola trebuie sa aiba minimum ${MIN_PASSWORD} caractere.` });
        }
        const hash = await bcrypt.hash(parola, SALT_ROUNDS);
        await pool.query(
            `INSERT INTO users (nume, email, parola_hash, telefon, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
            [nume, email, hash, telefon || null, role_id]
        );
        res.redirect('/users');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, { ...form, error: message });
        } catch (e) {
            next(e);
        }
    }
});

// UPDATE: formular
router.get('/:id/edit', async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, nume, email, telefon, role_id FROM users WHERE id = $1',
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Utilizator inexistent');
        await renderForm(res, {
            title: 'Editeaza utilizatorul', action: `/users/${req.params.id}`,
            user: result.rows[0], error: null, isNew: false,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare (parola se schimba doar daca este completata)
router.post('/:id', async (req, res, next) => {
    const { nume, email, telefon, parola, role_id } = req.body;
    const form = {
        title: 'Editeaza utilizatorul', action: `/users/${req.params.id}`,
        user: req.body, isNew: false,
    };
    try {
        if (parola && parola.length < MIN_PASSWORD) {
            return await renderForm(res, { ...form, error: `Parola trebuie sa aiba minimum ${MIN_PASSWORD} caractere.` });
        }
        let result;
        if (parola) {
            const hash = await bcrypt.hash(parola, SALT_ROUNDS);
            result = await pool.query(
                `UPDATE users SET nume = $1, email = $2, telefon = $3, role_id = $4, parola_hash = $5
         WHERE id = $6`,
                [nume, email, telefon || null, role_id, hash, req.params.id]
            );
        } else {
            result = await pool.query(
                `UPDATE users SET nume = $1, email = $2, telefon = $3, role_id = $4
         WHERE id = $5`,
                [nume, email, telefon || null, role_id, req.params.id]
            );
        }
        if (result.rowCount === 0) return res.status(404).send('Utilizator inexistent');
        res.redirect('/users');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderForm(res, { ...form, error: message });
        } catch (e) {
            next(e);
        }
    }
});

// DELETE
router.post('/:id/delete', async (req, res, next) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.redirect('/users');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            res.render('users/list', { users: await loadUsers(), error: message });
        } catch (e) {
            next(e);
        }
    }
});

module.exports = router;
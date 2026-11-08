const express = require('express');
const pool = require('../db');

const router = express.Router();

// rolurile de baza, pe care se vor construi drepturile de acces; nu se modifica
const BASE_ROLES = ['client', 'angajat', 'admin'];

router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(404).send('Rol inexistent');
    next();
});

async function loadRoles() {
    const result = await pool.query(
        `SELECT r.id, r.nume, count(u.id)::int AS nr_utilizatori
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id
     ORDER BY r.id`
    );
    return result.rows;
}

async function renderList(res, error) {
    res.render('roles/list', { roles: await loadRoles(), baseRoles: BASE_ROLES, error });
}

function friendlyError(err) {
    switch (err.code) {
        case '23505': return 'Exista deja un rol cu acest nume.';
        case '23503': return 'Rolul nu poate fi sters: exista utilizatori cu acest rol.';
        case '23514': return 'Numele rolului nu poate fi gol.';
        case '22001': return 'Numele rolului este prea lung (maxim 20 de caractere).';
        case '23502': return 'Numele rolului lipseste.';
        default: return null;
    }
}

function cleanName(body) {
    return (body.nume || '').trim().toLowerCase();
}

// rolul cu id-ul dat, sau null daca nu exista
async function findRole(id) {
    const result = await pool.query('SELECT id, nume FROM roles WHERE id = $1', [id]);
    return result.rows[0] || null;
}

const PROTECTED_MESSAGE = 'Rolurile de baza (client, angajat, admin) nu pot fi modificate sau sterse.';

// READ: lista
router.get('/', async (req, res, next) => {
    try {
        await renderList(res, null);
    } catch (err) {
        next(err);
    }
});

// CREATE: formular
router.get('/new', (req, res) => {
    res.render('roles/form', { title: 'Adauga rol', action: '/roles', role: {}, error: null });
});

// CREATE: salvare
router.post('/', async (req, res, next) => {
    const nume = cleanName(req.body);
    try {
        await pool.query('INSERT INTO roles (nume) VALUES ($1)', [nume]);
        res.redirect('/roles');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        res.render('roles/form', {
            title: 'Adauga rol', action: '/roles', role: { nume }, error: message,
        });
    }
});

// UPDATE: formular
router.get('/:id/edit', async (req, res, next) => {
    try {
        const role = await findRole(req.params.id);
        if (!role) return res.status(404).send('Rol inexistent');
        if (BASE_ROLES.includes(role.nume)) return await renderList(res, PROTECTED_MESSAGE);
        res.render('roles/form', {
            title: 'Editeaza rolul', action: `/roles/${role.id}`, role, error: null,
        });
    } catch (err) {
        next(err);
    }
});

// UPDATE: salvare
router.post('/:id', async (req, res, next) => {
    const nume = cleanName(req.body);
    try {
        const role = await findRole(req.params.id);
        if (!role) return res.status(404).send('Rol inexistent');
        if (BASE_ROLES.includes(role.nume)) return await renderList(res, PROTECTED_MESSAGE);
        await pool.query('UPDATE roles SET nume = $1 WHERE id = $2', [nume, role.id]);
        res.redirect('/roles');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        res.render('roles/form', {
            title: 'Editeaza rolul', action: `/roles/${req.params.id}`, role: { nume }, error: message,
        });
    }
});

// DELETE
router.post('/:id/delete', async (req, res, next) => {
    try {
        const role = await findRole(req.params.id);
        if (!role) return res.status(404).send('Rol inexistent');
        if (BASE_ROLES.includes(role.nume)) return await renderList(res, PROTECTED_MESSAGE);
        await pool.query('DELETE FROM roles WHERE id = $1', [role.id]);
        res.redirect('/roles');
    } catch (err) {
        const message = friendlyError(err);
        if (!message) return next(err);
        try {
            await renderList(res, message);
        } catch (e) {
            next(e);
        }
    }
});

module.exports = router;
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;
const MIN_PASSWORD = 8;

// hash fals, folosit cand emailul nu exista, ca timpul de raspuns sa fie asemanator
const DUMMY_HASH = bcrypt.hashSync('parola-fara-utilizator', SALT_ROUNDS);

// regenereaza sesiunea (impotriva session fixation) si memoreaza utilizatorul
function startSession(req, res, next, user) {
    req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.user = { id: user.id, nume: user.nume, email: user.email, rol: user.rol };
        req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);
            res.redirect('/');
        });
    });
}

// LOGIN: formular
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/login', { error: null, email: '' });
});

// LOGIN: verificare
router.post('/login', async (req, res, next) => {
    const email = (req.body.email || '').trim();
    const parola = req.body.parola || '';
    try {
        const result = await pool.query(
            `SELECT u.id, u.nume, u.email, u.parola_hash, r.nume AS rol
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE lower(u.email) = lower($1)`,
            [email]
        );
        const user = result.rows[0];
        const ok = await bcrypt.compare(parola, user ? user.parola_hash : DUMMY_HASH);
        if (!user || !ok) {
            return res.status(401).render('auth/login', { error: 'Email sau parola incorecte.', email });
        }
        startSession(req, res, next, user);
    } catch (err) {
        next(err);
    }
});

// REGISTER: formular
router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/register', { error: null, form: {} });
});

// REGISTER: creare cont (intotdeauna cu rolul client)
router.post('/register', async (req, res, next) => {
    const { nume, email, telefon, parola, confirmare } = req.body;
    const form = { nume, email, telefon };
    const fail = (message) => res.status(400).render('auth/register', { error: message, form });
    try {
        if (!parola || parola.length < MIN_PASSWORD) {
            return fail(`Parola trebuie sa aiba minimum ${MIN_PASSWORD} caractere.`);
        }
        if (parola !== confirmare) return fail('Parolele nu coincid.');

        const hash = await bcrypt.hash(parola, SALT_ROUNDS);
        const inserted = await pool.query(
            `INSERT INTO users (nume, email, parola_hash, telefon, role_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE nume = 'client'))
       RETURNING id, nume, email`,
            [nume, (email || '').trim(), hash, telefon || null]
        );
        startSession(req, res, next, { ...inserted.rows[0], rol: 'client' });
    } catch (err) {
        if (err.code === '23505') return fail('Exista deja un cont cu acest email.');
        if (err.code === '23502' || err.code === '22001') return fail('Date lipsa sau prea lungi.');
        next(err);
    }
});

// LOGOUT
router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;
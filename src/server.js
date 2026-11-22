require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./db');
const { loadUser, requireRole } = require('./middleware/auth');

if (!process.env.SESSION_SECRET) {
    console.error('Lipseste SESSION_SECRET din fisierul .env');
    process.exit(1);
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// sesiuni stocate in PostgreSQL (tabela "session" se creeaza automat)
app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8, // 8 ore
    },
}));

// pune utilizatorul curent la dispozitia paginilor
app.use(loadUser);

// orice stergere (POST .../delete) necesita rolul admin
app.use((req, res, next) => {
    if (req.method === 'POST' && req.path.endsWith('/delete')) {
        return requireRole('admin')(req, res, next);
    }
    next();
});

const staff = requireRole('angajat', 'admin');
const admin = requireRole('admin');

// pagina de start depinde de rol
app.get('/', (req, res) => {
    const user = req.session.user;
    if (user && (user.rol === 'angajat' || user.rol === 'admin')) return res.redirect('/rentals');
    res.redirect('/catalog');
});

app.use('/', require('./routes/account'));
app.use('/catalog', require('./routes/catalog'));
app.use('/my-rentals', requireRole('client'), require('./routes/my-rentals'));

app.use('/cars', staff, require('./routes/cars'));
app.use('/rentals', staff, require('./routes/rentals'));
app.use('/payments', staff, require('./routes/payments'));

app.use('/categories', admin, require('./routes/categories'));
app.use('/extras', admin, require('./routes/extras'));
app.use('/users', admin, require('./routes/users'));
app.use('/roles', admin, require('./routes/roles'));

// tratarea erorilor neprevazute
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Eroare de server: ' + err.message);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server pornit pe http://localhost:${port}`);
});
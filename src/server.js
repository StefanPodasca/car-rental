require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./db');
const { loadUser } = require('./middleware/auth');

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

app.get('/', (req, res) => res.redirect('/cars'));
app.use('/', require('./routes/account'));
app.use('/cars', require('./routes/cars'));
app.use('/categories', require('./routes/categories'));
app.use('/extras', require('./routes/extras'));
app.use('/users', require('./routes/users'));
app.use('/rentals', require('./routes/rentals'));
app.use('/payments', require('./routes/payments'));
app.use('/roles', require('./routes/roles'));

// tratarea erorilor neprevazute
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Eroare de server: ' + err.message);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server pornit pe http://localhost:${port}`);
});
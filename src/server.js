require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.redirect('/cars'));

app.get('/cars', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.marca, c.model, c.an, c.numar_inmatriculare,
              c.pret_pe_zi, c.stare, cat.nume AS categorie
       FROM cars c
       JOIN categories cat ON cat.id = c.category_id
       ORDER BY c.id`
        );
        res.render('cars', { cars: result.rows });
    } catch (err) {
        next(err);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server pornit pe http://localhost:${port}`);
});
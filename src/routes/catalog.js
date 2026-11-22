const express = require('express');
const pool = require('../db');

const router = express.Router();

// data valida in format AAAA-LL-ZZ (respinge si 2026-02-31)
function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// catalog public: masinile disponibile, filtrate dupa perioada si categorie
router.get('/', async (req, res, next) => {
    const { data_start = '', data_end = '', category_id = '' } = req.query;
    const filters = { data_start, data_end, category_id };
    try {
        const categories = await pool.query('SELECT id, nume FROM categories ORDER BY nume');

        const params = [];
        const where = [`c.stare <> 'service'`];
        let zile = null;
        let error = null;

        if (/^\d+$/.test(category_id)) {
            params.push(category_id);
            where.push(`c.category_id = $${params.length}`);
        }

        if (data_start || data_end) {
            if (!validDate(data_start) || !validDate(data_end)) {
                error = 'Alege doua date valide, pentru a vedea masinile libere in perioada respectiva.';
            } else if (data_end <= data_start) {
                error = 'Data de sfarsit trebuie sa fie dupa data de inceput.';
            } else {
                params.push(data_start);
                const p1 = params.length;
                params.push(data_end);
                const p2 = params.length;
                // exclude masinile care au o rezervare (neanulata) suprapusa cu perioada aleasa
                where.push(
                    `NOT EXISTS (
             SELECT 1 FROM rentals r
             WHERE r.car_id = c.id AND r.stare <> 'anulata'
               AND daterange(r.data_start, r.data_end, '[)')
                   && daterange($${p1}::date, $${p2}::date, '[)')
           )`
                );
                zile = Math.round((new Date(data_end) - new Date(data_start)) / 86400000);
            }
        }

        let cars = [];
        if (!error) {
            const result = await pool.query(
                `SELECT c.id, c.marca, c.model, c.an, c.pret_pe_zi, cat.nume AS categorie
         FROM cars c
         JOIN categories cat ON cat.id = c.category_id
         WHERE ${where.join(' AND ')}
         ORDER BY c.pret_pe_zi, c.id`,
                params
            );
            cars = result.rows;
        }

        res.render('catalog/list', { cars, categories: categories.rows, filters, zile, error });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
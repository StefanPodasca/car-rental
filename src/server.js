require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.redirect('/cars'));
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
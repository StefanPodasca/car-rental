// pune utilizatorul din sesiune la dispozitia tuturor paginilor (variabila currentUser)
function loadUser(req, res, next) {
    res.locals.currentUser = req.session.user || null;
    next();
}

// permite accesul doar utilizatorilor autentificati cu unul dintre rolurile date
function requireRole(...roles) {
    return (req, res, next) => {
        const user = req.session.user;
        if (!user) return res.redirect('/login');
        if (!roles.includes(user.rol)) return res.status(403).render('errors/forbidden');
        next();
    };
}

module.exports = { loadUser, requireRole };
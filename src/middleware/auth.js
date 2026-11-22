// pune utilizatorul din sesiune la dispozitia tuturor paginilor (variabila currentUser)
function loadUser(req, res, next) {
    res.locals.currentUser = req.session.user || null;
    next();
}

module.exports = { loadUser };
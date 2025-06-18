function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  req.flash('error', 'You must be logged in to access this page');
  res.redirect('login');
}

function isGuest(req, res, next) {
  if (!req.session.user) {
    return next();
  }
  res.redirect('/explorer');
}

module.exports = {
  isAuthenticated,
  isGuest
};

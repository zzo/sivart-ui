var express = require('express');
var router = express.Router();
var path = require('path');
var passport = require('passport');
var User = require('sivart-data/User');
var GitHubStrategy = require('passport-github2').Strategy;

var GITHUB_CLIENT_ID = '9a6a8bf629ea65ec2a48';
var GITHUB_CLIENT_SECRET = '5908ca41eb879d2a70933bd7b23a5821465faebf';

passport.serializeUser(function(user, done) {
  delete user._raw; // don't want this
  var newUser = new User(user.emails[0].value)
  newUser.create(user, function(err) {
    done(err, user.emails[0].value);
  });
});

passport.deserializeUser(function(obj, done) {
  var user = new User(obj);
  user.get(done);
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:8000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    return done(null, profile);
  }
));

router.use(passport.initialize());
router.use(passport.session());

// make user available to all templates
router.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});

router.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

router.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

router.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email', 'write:repo_hook' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  }
);

// GET /auth/github/callback
router.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  function(req, res) {
    // send em back from whence they came
    res.redirect(req.get('Referer'));
  }
);

router.get('/logout', function(req, res){
  req.logout();
  res.redirect(req.get('Referer'));
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

module.exports = router;

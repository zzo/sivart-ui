'use strict';

var express = require('express'),
  app = express(),
  session = require('cookie-session'),
  github = require('octonode'),
  lusca = require('lusca'),
  exphbs  = require('express-handlebars'),
  helpers = require('./views/helpers/newHelpers') // be fancier about this
  var Q = require('q')
;

var port = process.env.NODE_ENV === 'production' ? 80 : 8000;

app.engine('handlebars', exphbs({
  extname:'handlebars',
  defaultLayout: 'main',
  helpers: helpers,
}));

app.set('view engine', 'handlebars');

app.use(session({
    secret: 'sivart',
    resave: true,
    saveUninitialized: true
}));

// https://github.com/krakenjs/lusca
app.use(lusca({
    csrf: true,
    csp: { /* ... */},
    xframe: 'SAMEORIGIN',
    p3p: 'ABCDEF',
    hsts: {maxAge: 31536000, includeSubDomains: true, preload: true},
    xssProtection: true
}));

console.log('Listening on %s', port);
var server = app.listen(port);
app.use(express.static('static'));

// SSH stuff needs special handling for socket.io
require('./SSH')(server, app);

// Regular routes
var buildLists = require('./routes/BuildList');
var buildSingle = require('./routes/BuildSingle');
var runSingle = require('./routes/RunSingle');
var redoOrCancel = require('./routes/RedoOrCancel');
var getFile = require('./routes/GetFile');
var login = require('./routes/Login');
var ghhook = require('./routes/AddGithubHook');

app.use('/', login); //must come first!
app.use('/', ghhook); //must come second!
app.use('/', buildLists);
app.use('/', buildSingle);
app.use('/', runSingle);
app.use('/', redoOrCancel);
app.use('/', getFile);

app.use(function(req, res, next){
  if (req.user) {
    var client = github.client(req.user.accessToken);
    var ghme = client.me();
    ghme.repos(function(err, data) {
      if (!err) {
        var repos = data.map(function(repo) {
          return repo.full_name;
        });
      }
      res.render('index', { repos: repos });
    });
  } else {
    res.render('index');
  }
});

// generic error handling
app.use(function(err, req, res, next){
  res.status(404);

  // respond with html page
  if (req.accepts('html')) {
    res.render('404', { url: req.url, error: err });
    return;
  }

  // respond with json
  if (req.accepts('json')) {
    res.send({ error: err });
    return;
  }

  // default to plain-text. send()
  res.type('txt').send('Not found');
});

console.log('__ALIVE__');

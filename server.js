'use strict';

var express = require('express'),
  app = express(),
  session = require('cookie-session'),
  lusca = require('lusca'),
  exphbs  = require('express-handlebars'),
  port = process.argv[2] || 8000,
  helpers = require('./views/helpers/newHelpers') // be fancier about this
;

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
app.use('/', buildLists);
app.use('/', buildSingle);
app.use('/', runSingle);
app.use('/', redoOrCancel);

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

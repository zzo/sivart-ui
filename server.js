var express = require('express'),
  app = express(),
  path = require('path'),
  session = require('express-session'),
  lusca = require('lusca'),
  exphbs  = require('express-handlebars')
  ReadData = require('sivart-data/ReadBuildData'),
  port = process.argv[2] || 8000,
  gcloud = require('gcloud'),
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

app.use(express.static('static'));

app.get('/:username/:repo', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var readData = new ReadData(repoName);
  readData.getSomePushBuilds(function(err, data) {
    if (err) {
      res.error();
    } else {
      data = data.reverse();
      res.render('buildList', { kind: 'push', kind: 'push', type: 'Push', builds: data, repoName: repoName });
    }
  });
});

app.get('/:username/:repo/pull_requests', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var readData = new ReadData(repoName);
  readData.getSomePRBuilds(function(err, data) {
    data = data.reverse();
    res.render('home', { kind: 'pull_request', type: 'Pull Requests', builds: data, repoName: repoName });
  });
});

// view a single build
app.get('/:username/:repo/jobs/:kind/:branch/:buildId/:buildNumber', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var kind = req.params.kind;
  var repoName = path.join(username, repo);
  var branch = req.params.branch;
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;
  var readData = new ReadData(repoName);
  readData.getABuild(kind, buildId, function(err, buildInfo) {
    if (err) {
      console.log(err);
      // send 404?
      res.render('single', { mainLog: 'build not found', repoName: repoName });
    } else {
      readData.getMainLogFile(branch, buildId, buildNumber, function(err, data) {
        if (!err) {
          res.render('single', {
            buildInfo: buildInfo,
            branch: branch,
            buildId: buildId,
            buildNumber: buildNumber,
            mainLog: data.toString(),
            repoName: repoName,
            type: kind
          });
        } else {
          if (err.code === 404) {
            // send 404?
            res.render('single', { mainLog: 'build not found', repoName: repoName });
          }
        }
      });
    }
  });
});

app.get('/getFile/:username/:repo/:branch/:buildId/:buildNumber/:filename', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var branch = req.params.branch;
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;
  var filename = req.params.filename;
  var readData = new ReadData(repoName);

  readData.getLogFile(branch, buildId, buildNumber, filename, function(err, contents) {
    res.end(contents);
  });
});


console.log('Listening on %s', port);
app.listen(port);

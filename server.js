'use strict';

var express = require('express'),
  app = express(),
  path = require('path'),
  session = require('express-session'),
  lusca = require('lusca'),
  exphbs  = require('express-handlebars'),
  Datastore = require('sivart-data/Datastore'),
  Filestore = require('sivart-data/Filestore'),
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

app.use(express.static('static'));

app.get('/', function (req, res) {
  res.render('buildSingle', { });
});

app.get('/:username/:repo', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var datastore = new Datastore(repoName);

  datastore.getCurrentBuild(function(err, build) {
    if (err) {
      // send 404
      res.render('buildSingle', { type: 'Current', repoName: repoName });
    } else {
      build.yesFail = build.runs.filter(function(run) {
        return run.ignoreFailure;
      });
      build.noFail = build.runs.filter(function(run) {
        return !run.ignoreFailure;
      });

      res.render('buildSingle', { type: 'Current', build: build, repoName: repoName });
    }
  });
});

app.get('/:username/:repo/push', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var datastore = new Datastore(repoName);
  datastore.getSomePushBuilds(function(err, data) {
    if (err) {
      res.render('buildList', { type: 'Branches', repoName: repoName });
    } else {
      data = data.reverse();
      res.render('buildList', { type: 'Branches', builds: data, repoName: repoName });
    }
  });
});

app.get('/:username/:repo/pull_requests', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var datastore = new Datastore(repoName);
  datastore.getSomePRBuilds(function(err, data) {
    if (err) {
      res.render('buildList', { type: 'Pull Requests', repoName: repoName });
    } else {
      data = data.reverse();
      res.render('buildList', { type: 'Pull Requests', builds: data, repoName: repoName });
    }
  });
});

// view a single build details
app.get('/:username/:repo/jobs/:buildId', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  var datastore = new Datastore(repoName);
  datastore.getABuild(buildId, function(err, build) {
    if (err) {
      // 404?
      res.render('buildSingle', { repoName: repoName, buildId: buildId });
    } else {
      // split up the runs into allowed / notallowed failures
      build.yesFail = build.runs.filter(function(run) {
        return run.ignoreFailure;
      });
      build.noFail = build.runs.filter(function(run) {
        return !run.ignoreFailure;
      });

      res.render('buildSingle', { build: build, repoName: repoName, buildId: buildId });
    }
  });
});

// view a single build run
app.get('/:username/:repo/jobs/:branch/:buildId/:buildNumber', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var branch = req.params.branch;
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;
  var datastore = new Datastore(repoName);
  var filestore = new Filestore(repoName);
  datastore.getABuild(buildId, function(err, buildInfo) {
    if (err) {
      // send 404?
      res.render('single', { mainLog: 'build not found', repoName: repoName });
    } else {
      filestore.getMainLogFile(branch, buildId, buildNumber, function(err, data) {
        if (!err) {
          res.json({
            buildInfo: buildInfo,
            branch: branch,
            buildId: buildId,
            buildNumber: buildNumber,
            mainLog: data.toString(),
            repoName: repoName
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
  var filestore = new Filestore(repoName);

  filestore.getLogFile(branch, buildId, buildNumber, filename, function(err, contents) {
    res.end(contents);
  });
});


console.log('Listening on %s', port);
app.listen(port);
console.log('__ALIVE__');

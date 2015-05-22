'use strict';
var fs =require('fs');

var express = require('express'),
  app = express(),
  path = require('path'),
  session = require('cookie-session'),
  lusca = require('lusca'),
  exphbs  = require('express-handlebars'),
  Datastore = require('sivart-data/Datastore'),
  Filestore = require('sivart-data/Filestore'),
  port = process.argv[2] || 8000,
  helpers = require('./views/helpers/newHelpers'), // be fancier about this
  Instance = require('sivart-GCE/Instance'), // for tailing live VM output
  Auth = require('sivart-GCE/Auth'), // for tailing live VM output
  Redo = require('sivart-slave/RedoBuild'),
  Cancel = require('sivart-slave/CancelBuild')
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
      res.json({ mainLog: 'build ' + buildId + ' not found', repoName: repoName });
    } else {
      buildInfo.runs.forEach(function(run) {
        var script= '';
        run.script.slice(0).forEach(function(ch) {
          script += String.fromCharCode(ch);
        });
        //console.log(script);
        //console.log(run.script);
        //String.fromCharCode
        if (String(run.buildNumber) === buildNumber) {
          if (run.state === 'running' || run.state === 'building') {
            var instance = new Instance(Auth.projectId, Auth.zone, run.instanceName);
            instance.getSerialConsoleOutput(function(err, output) {
              if (err) {
                res.json({ mainLog: 'Error fetching build log', repoName: repoName });
              } else {
                fs.writeFileSync('/tmp/sout', output.contents, 'utf8');
                res.json({
                  mainLog: output.contents,
                  status: 'running',
                  branch: branch,
                  buildId: buildId,
                  buildNumber: buildNumber,
                  repoName: repoName
                });
              }
            });
          } else {
            filestore.getMainLogFile(buildId, buildNumber, function(err, data) {
              if (!err) {
                res.json({
                  branch: branch,
                  buildId: buildId,
                  buildNumber: buildNumber,
                  mainLog: data.toString(),
                  repoName: repoName,
                  baseURL: filestore.getBasePublicURL(branch, buildId, buildNumber)
                });
              } else {
                if (err.code === 404) {
                  // send 404?
                  res.json({ mainLog: 'main log file for ' + buildId + ' not found', repoName: repoName });
                }
              }
            });
          }
        }
      });
    }
  });
});

//https://console.developers.google.com/m/cloudstorage/b/sivart-angular-angular/o/branch-master/237/3/user-script.log

app.get('/getFile/:username/:repo/:branch/:buildId/:buildNumber/:filename', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var branch = req.params.branch;
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;
  var filename = req.params.filename;
  var filestore = new Filestore(repoName);

  filestore.getLogFile(buildId, buildNumber, filename, function(err, contents) {
    if (err) {
      console.log('error fetching file');
    }
    res.end(contents);
  });
});

app.get('/redoBuild/:username/:repo/:buildId', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  Redo.RedoEntireBuild(repoName, buildId, function(err) {
    /*
    if (err) {
      console.log(err);
      res.send({ error: err });
    } else {
      res.redirect(path.join('/', repoName, 'jobs', buildId));
    }
  */
  });
  res.redirect(path.join('/', repoName, 'jobs', buildId));
});

app.get('/redoRun/:username/:repo/:buildId/:buildNumber', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;

  Redo.RedoOneRun(repoName, buildId, buildNumber, function(err) {
    /*
    if (err) {
      console.log(err);
      res.json({ error: err });
    } else {
      res.json({});
    }
    */
  });
  res.json({});
});

app.get('/cancelBuild/:username/:repo/:buildId', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  Cancel.CancelBuild(repoName, buildId, function(err) {
    /*
    if (err) {
      console.log(err);
      res.send({ error: err });
    } else {
      res.redirect(path.join('/', repoName, 'jobs', buildId));
    }
    */
  });
  res.redirect(path.join('/', repoName, 'jobs', buildId));
});

app.get('/cancelRun/:username/:repo/:buildId/:buildNumber', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;

  Cancel.CancelRun(repoName, buildId, buildNumber, function(err) {
    /*
    if (err) {
      console.log(err);
      res.json({ error: err });
    } else {
      res.json({});
    }
    */
  });
  res.json({});
});

app.use(function(req, res, next){
  res.status(404);

  // respond with html page
  if (req.accepts('html')) {
    res.render('404', { url: req.url });
    return;
  }

  // respond with json
  if (req.accepts('json')) {
    res.send({ error: 'Not found' });
    return;
  }

  // default to plain-text. send()
  res.type('txt').send('Not found');
});

console.log('Listening on %s', port);
app.listen(port);
console.log('__ALIVE__');

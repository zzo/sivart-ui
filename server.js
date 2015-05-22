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
  Cancel = require('sivart-slave/CancelBuild'),
  child_pty = require('child_pty'),
  ss = require('socket.io-stream'),
  ptys = {},
  uuid = require('uuid'),
  GetLiveFile = require('sivart-slave/GetLiveFile')
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
var io = require('socket.io').listen(server);

// for ssh stuff
io.of('pty').on('connection', function(socket) {
	// receives a bidirectional pipe from the client see index.html
	// for the client-side
  ss(socket).on('error', function(err) {
    console.log('GOT ERROR: ');
    console.log(err);
  });
	ss(socket).on('new', function(stream, options) {
		var name = uuid.v4();

    // options from ssh.handlebars built from data-* attributes
    var buildId = options.buildid;
    var buildNumber = options.buildnumber;
    var repoName = options.reponame;

    // Need to get IP address of this instance and its private key
    // First get the private key as that method conveniently also returns the 'run' object
    //  that has the the instance name which we need to get its IP address..
    var datastore = new Datastore(repoName);
    datastore.getPrivateKey(buildId, buildNumber, function(err, privateKey, run) {
      if (err) {
        // ??
      } else {
        // need to write out private key somewhere for ssh like it likes it
        var privateKeyFile = '/tmp/' + String(buildId) + String(buildNumber) + '.private';
        fs.writeFileSync(privateKeyFile, privateKey, { mode: 384 }); // 0600 in octal
        // Now get IP address
        var instance = Instance.Factory('slave', run.instanceName);
        instance.getIP(function(err, ip) {
          if (err) {
            // ??
          } else {
            // Ready to spawn off ssh command on pty!
            var pty = child_pty.spawn('ssh',
              [
                '-i', privateKeyFile,
                '-o', 'UserKnownHostsFile=/dev/null',
                '-o', 'CheckHostIP=no',
                '-o', 'StrictHostKeyChecking=no',
                'sivart@' + ip
              ], options);

            // wire it up
		        pty.stdout.pipe(stream).pipe(pty.stdin);

            // save it off
		        ptys[name] = pty;

		        socket.on('disconnect', function() {
			        pty.kill('SIGHUP');
			        delete ptys[name];
		        });
          }
        });
      }
    });
	});
});

app.use(express.static('static'));

// FOR SSH
app.get('/terminal.js', function (req, res) {
  var file = '/node_modules/terminal.js/dist/terminal.js';
  fs.createReadStream(__dirname + file).pipe(res);;
});

app.get('/socket.io-stream.js', function (req, res) {
  var file = '/node_modules/socket.io-stream/socket.io-stream.js';
  fs.createReadStream(__dirname + file).pipe(res);;
});
// END FOR SSH

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
        if (!run.script) {
          return;
        }
        run.script.slice(0).forEach(function(ch) {
          script += String.fromCharCode(ch);
        });
        if (String(run.buildNumber) === buildNumber) {
          if (run.state === 'running' || run.state === 'building') {
//            var instance = Instance.Factory('slave', run.instanceName);
//            instance.getSerialConsoleOutput(function(err, output) {
            var glf = new GetLiveFile(repoName, buildId, buildNumber, '/tmp/user-script.log');
            glf.fetch(function(err, contents) {
              if (err) {
                res.json({ mainLog: 'Error fetching build log', repoName: repoName });
              } else {
                res.json({
                  //mainLog: output.contents,
                  mainLog: contents,
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

app.get('/ssh/:username/:repo/:buildId/:buildNumber', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;

 res.render('ssh', {layout: false, repoName: repoName, buildId: buildId, buildNumber: buildNumber });
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

// clean up any leftover ptys
process.on('exit', function() {
	var k = Object.keys(ptys);
	var i;

	for(i = 0; i < k.length; i++) {
		ptys[k].kill('SIGHUP');
	}
});

console.log('__ALIVE__');

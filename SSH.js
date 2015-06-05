'use strict';

var path = require('path');
var http = require('http');

module.exports = function(server, app) {
  var fs = require('fs');
  var io = require('socket.io').listen(server);
  var ss = require('socket.io-stream');
  var uuid = require('uuid');
  var Filestore = require('sivart-data/Filestore');
  var Datastore = require('sivart-data/Datastore');
  var child_pty = require('child_pty');
  var ptys = {};

  // for ssh stuff
  io.of('pty').on('connection', function(socket) {
    // receives a bidirectional pipe from the client see index.html
    // for the client-side
    ss(socket).on('error', function(err) {
      console.log(err);
    });
    ss(socket).on('new', function(stream, options) {
      var name = uuid.v4();

      // options from ssh.handlebars built from data-* attributes
      var buildId = options.buildid;
      var buildNumber = options.buildnumber;
      var repoName = options.reponame;
      var branch = options.branch;

      // Need to get IP address of this instance and its private key
      // First get the private key as that method conveniently also returns the 'run' object
      //  that has the the instance name which we need to get its IP address..
      var filestore = new Filestore(repoName);
      var datastore = new Datastore(repoName);

      var publicBase = filestore.getBasePublicURL(branch, buildId, buildNumber); 
      var URL = 'http://storage.googleapis.com/' + publicBase +  '/private.key';
      http.get(URL, function(fileResult) {
        var privateKey = '';
        fileResult.on('data', function(chunk) {
          privateKey += chunk.toString();
        });
        fileResult.on('error', function(chunk) {
          socket.emit('ssherror', { error: err, message: err.toString() + ' maybe host not ready yet...' });
        });

        fileResult.on('end', function(chunk) {
          // need to write out private key somewhere for ssh like it likes it
          var privateKeyFile = '/tmp/' + name + '.private';
          fs.writeFileSync(privateKeyFile, privateKey.toString(), { mode: 384 }); // 0600 in octal
          // Now get IP address
          datastore.getRun(buildId, buildNumber, function(grerr, run) {
            if (grerr) {
              socket.emit('ssherror', { error: grerr, message: grerr.errors[0].message });
            } else {
              // Ready to spawn off ssh command on pty!
              var pty = child_pty.spawn('ssh',
                [
                  '-i', privateKeyFile,
                  '-o', 'UserKnownHostsFile=/dev/null',
                  '-o', 'CheckHostIP=no',
                  '-o', 'StrictHostKeyChecking=no',
                  'sivart@' + run.ip
                ], options);

              // wire it up
              pty.stdout.pipe(stream).pipe(pty.stdin);

              // save it off
              ptys[name] = pty;

              pty.on('exit', function(code, signal) {
                socket.disconnect();
              });

              socket.on('disconnect', function() {
                fs.unlinkSync(privateKeyFile);
                pty.kill('SIGHUP');
                delete ptys[name];
              });
            }
          });
        });
      });
    });
  });

  app.get('/terminal.js', function (req, res) {
    var file = '/node_modules/terminal.js/dist/terminal.js';
    fs.createReadStream(__dirname + file).pipe(res);;
  });

  app.get('/socket.io-stream.js', function (req, res) {
    var file = '/node_modules/socket.io-stream/socket.io-stream.js';
    fs.createReadStream(__dirname + file).pipe(res);;
  });

  // clean up any leftover ptys
  process.on('exit', function() {
    var k = Object.keys(ptys);
    var i;

    for(i = 0; i < k.length; i++) {
      fs.unlinkSync('/tmp/' + k + '.private');
      ptys[k].kill('SIGHUP');
    }
  });

  app.get('/ssh/:username/:repo/:branch/:buildId/:buildNumber', function (req, res) {
    var username = req.params.username;
    var repo = req.params.repo;
    var repoName = path.join(username, repo);
    var branch = req.params.branch;
    var buildId = req.params.buildId;
    var buildNumber = req.params.buildNumber;

    res.render('ssh', {
      layout: false,
      repoName: repoName,
      branch: branch,
      buildId: buildId,
      buildNumber: buildNumber
    });
  });
};

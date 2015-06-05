var express = require('express');
var router = express.Router();
var path = require('path');
var Datastore = require('sivart-data/Datastore');
var Filestore = require('sivart-data/Filestore');
var GetLiveFile = require('sivart-slave/GetLiveFile');
var http = require('http');

// view a single build run
router.get('/:username/:repo/jobs/:branch/:buildId/:buildNumber', function (req, res, next) {
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
      return next(404);
    } else {
      buildInfo.runs.forEach(function(run) {
        if (String(run.buildNumber) === buildNumber) {
          if (run.state === 'running' || run.state === 'building') {
            var glf = new GetLiveFile(repoName, buildId, buildNumber, '/tmp/user-script.log');
            glf.fetch(function(err, contents) {
              if (err) {
//                return next(err);
                res.json({
                  mainLog: 'cannot get log file right now: ' + err,
                  status: 'running',
                  branch: branch,
                  buildId: buildId,
                  buildNumber: buildNumber,
                  repoName: repoName
                });
              } else {
                res.json({
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
            // Just get the cleaned user script output directly from google - way faster
            var publicBase = filestore.getBasePublicURL(branch, buildId, buildNumber); 
            var URL = 'http://storage.googleapis.com/' + publicBase +  '/user-script.clean.log'
            http.get(URL, function(fileResult) {
              var data = '';
              fileResult.on('data', function(chunk) {
                data += chunk.toString();
              });
              fileResult.on('end', function() {
                res.json({
                  branch: branch,
                  buildId: buildId,
                  buildNumber: buildNumber,
                  mainLog: data,
                  repoName: repoName,
                  baseURL: publicBase
                });
              });
            }).on('error', function(e) {
              console.log("Got error: " + e.message);
              return next(err);
            });
          }
        }
      });
    }
  });
});

router.use(function(error, req, res, next) {
  next(error);
});

module.exports = router;

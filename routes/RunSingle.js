var express = require('express');
var router = express.Router();
var path = require('path');
var Datastore = require('sivart-data/Datastore');
var Filestore = require('sivart-data/Filestore');
var GetLiveFile = require('sivart-slave/GetLiveFile');

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
                return next(err);
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
                return next(err);
              }
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

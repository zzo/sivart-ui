var express = require('express');
var router = express.Router();
var path = require('path');
var Redo = require('sivart-slave/RedoBuild');
var Cancel = require('sivart-slave/CancelBuild');

router.get(/\/(redo|cancel)Build\/(\w+)\/(\w+)\/(\d+)/, function (req, res) {
  var which = req.params[0];
  var username = req.params[1];
  var repo = req.params[2];
  var repoName = path.join(username, repo);
  var buildId = req.params[3];
  var func = which === 'redo' ? Redo.RedoEntireBuild : Cancel.CancelBuild;
  func(repoName, buildId, function(err) {
    // do something w/error
  });
  setTimeout(function() {
    res.redirect(path.join('/', repoName, 'jobs', buildId));
  }, 5000);
});

router.get(/\/(redo|cancel)Build\/(\w+)\/(\w+)\/(\d+)\/(\d+)/, function (req, res) {
  var which = req.params[0];
  var username = req.params[1];
  var repo = req.params[2];
  var repoName = path.join(username, repo);
  var buildId = req.params[3];
  var buildNumber = req.params[4];
  var func = which === 'redo' ? Redo.RedoOneRun : Cancel.CancelRun;
  func(repoName, buildId, buildNumber, function(err) {
    // do something w/error
  });

  setTimeout(function() {
    res.json({});
  }, 5000);
});

module.exports = router;

var express = require('express');
var router = express.Router();
var path = require('path');
var Datastore = require('sivart-data/Datastore');

// Get the latest build
router.get('/:username/:repo', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var datastore = new Datastore(repoName);

  datastore.getCurrentBuildId(function(err, id) {
    res.redirect(path.join('/', username, repo, 'jobs', String(id)));
  });
});

// view a single build details
router.get('/:username/:repo/jobs/:buildId', function (req, res, next) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var buildId = req.params.buildId;
  var datastore = new Datastore(repoName);

  datastore.getABuild(buildId, function(err, build) {
    if (err) {
      return next(404);
    } else {
      // split up the runs into allowed / notallowed failures
      build.yesFail = build.runs.filter(function(run) {
        return run.ignoreFailure;
      });
      build.noFail = build.runs.filter(function(run) {
        return !run.ignoreFailure;
      });

      res.render('individualBuildFat', {
        build: build,
        repoName: repoName,
        buildId: buildId
      });
    }
  });
});

router.use(function(error, req, res, next) {
  res.render('404', { url: req.url, error: error });
});

module.exports = router;

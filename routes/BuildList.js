var express = require('express');
var router = express.Router();
var path = require('path');
var Datastore = require('sivart-data/Datastore');

router.param('action', function(req, res, next, action) {
  if (action.match(/^(push|pull_requests)$/)) {
    req.action = action;
    next();
  } else {
    next(404);
  }
});

router.get('/:username/:repo/:action', function (req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var action = req.action;
  var datastore = new Datastore(repoName);

  var func = datastore.getSomePushBuilds;
  var type = 'Branches';

  if (action === 'pull_requests') {
    func = datastore.getSomePRBuilds;
    type = 'Pull Requests';
  }

  func.call(datastore, function(err, data) {
    if (err) {
      res.render('buildList', { type: type, repoName: repoName });
    } else {
      data = data.reverse();
      res.render('buildList', { type: type, builds: data, repoName: repoName });
    }
  });
});

router.use(function(error, req, res, next) {
  next(error);
});

module.exports = router;

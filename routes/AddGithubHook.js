var github = require('octonode');
var express = require('express');
var router = express.Router();
var path = require('path');
var User = require('sivart-data/User');

router.get('/addgithubhook/:username/:repo', function(req, res) {
  if (!req.user) {
    // Ya gotta login!
    res.render('index', { message: 'You must log in to do this!' });
  } else {
    var username = req.params.username;
    var repo = req.params.repo;
    var repoName = path.join(username, repo);
  
    var client = github.client(req.user.accessToken);
    var ghrepo = client.repo(repoName);
    var me = 'http://github.xci.pub/github';
    var args = { repoName: repoName };

    // maybe already there??
    ghrepo.hooks(function(err, data) {
      if (err) {
        args.err = "You do not have permission to list (let alone add!) a webhook to this repo - nice try!  Talk to someone who does!!!";
        res.render("addgithubhook", args);
      } else {
        var found = data.filter(function(hook) {
          return hook.config.url === me;
        });
        if (!found.length) {
          ghrepo.hook({
            name: 'web',
            active: true,
            events: ['push', 'pull_request'],
            config: {
              url: me,
              content_type: 'json'
            }
          }, function(err, data, headers) {
            if (err) {
              args.err = "You do not have permission to add a hook to the repo " + repoName;
            } 
            res.render("addgithubhook", args);
          });
        } else {
          res.render("addgithubhook", args);
        }
      }
    });
  }
});

module.exports = router;

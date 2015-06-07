var github = require('octonode');
var express = require('express');
var router = express.Router();
var path = require('path');
var User = require('sivart-data/User');
var myHook = 'http://github.xci.pub/github';

router.get('/hasgithubhook/:username/:repo', function(req, res) {
  if (!req.user) {
    // Ya gotta login!
    res.json({error: 'Must be logged in'});
  } else {
    var username = req.params.username;
    var repo = req.params.repo;
    var repoName = path.join(username, repo);
  
    var client = github.client(req.user.accessToken);
    var ghrepo = client.repo(repoName);

    ghrepo.hooks(function(err, data) {
      if (err) {
        err = "You do not have permission to list webhooks for this repo - nice try!  Talk to someone who does!!!";
        res.json({err: err});
      } else {
        var found = data.filter(function(hook) {
          return hook.config.url === myHook;
        });

        res.json({ hook: found.length });
      }
    });
  }
});

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
    var args = { repoName: repoName };

    // maybe already there??
    ghrepo.hooks(function(err, data) {
      if (err) {
        args.err = "You do not have permission to list (let alone add!) a webhook to this repo - nice try!  Talk to someone who does!!!";
        res.render("addgithubhook", args);
      } else {
        console.log(data);
        var found = data.filter(function(hook) {
          return hook.config.url === myHook;
        });
        if (!found.length) {
          ghrepo.hook({
            name: 'web',
            active: true,
            events: ['push', 'pull_request'],
            config: {
              url: myHook,
              content_type: 'json'
            }
          }, function(err, data, headers) {
            if (err) {
              args.err = "You do not have permission to add a hook to the repo " + repoName;
            } 
            // Add keys for this repo
            var createRepoKeys = require('sivart-slave/CreateRepoKeys');
            createRepoKeys(repoName, function(err) {
              if (err) {
                args.err = err;
              } 
              res.render("addgithubhook", args);
            });
          });
        } else {
          res.render("addgithubhook", args);
        }
      }
    });
  }
});

module.exports = router;

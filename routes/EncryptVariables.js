var express = require('express');
var router = express.Router();
var path = require('path');
var RepoCrypto = require('sivart-slave/RepoCrypto');

router.post('/encrypt', function(req, res) {
  var encMe = req.body.encryptMe;
  var repo = req.body.repoName;
  RepoCrypto.encrypt(repo, encMe, function(err, encrypted) {
    var resp = {};
    if (err) {
      resp.error = err;
    } else {
      resp.encrypted = encrypted;
    }
    res.json(resp);
  });
});

router.get('/encryptVariables/:username/:repo', function(req, res) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  res.render('encryptVariables', { repoName: repoName });
});
 
module.exports = router;

var express = require('express');
var router = express.Router();
var path = require('path');
var http = require('http');
var Filestore = require('sivart-data/Filestore');

router.get('/getFile/:username/:repo/:branch/:buildId/:buildNumber/:filename', function (req, res, next) {
  var username = req.params.username;
  var repo = req.params.repo;
  var repoName = path.join(username, repo);
  var branch = req.params.branch;
  var buildId = req.params.buildId;
  var buildNumber = req.params.buildNumber;
  var filename = req.params.filename;
  var filestore = new Filestore(repoName);

  // Just get the cleaned user script output directly from google - way faster
  var publicBase = filestore.getBasePublicURL(branch, buildId, buildNumber); 
  var URL = 'http://storage.googleapis.com/' + publicBase +  '/' + filename;
  http.get(URL, function(fileResult) {
    fileResult.pipe(res);
  });
});

router.use(function(error, req, res, next) {
  next(err);
});

module.exports = router;

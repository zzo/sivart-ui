'use strict';

var path = require('path');

exports.getbranch = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return "PR #" + github.number;
  } else {
    return path.basename(github.ref) || 'master';
  }
};

// this is the current build
exports.topinfo = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.title;
  } else {
     return github.head_commit.message;
  }
};

exports.info = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.html_url;
  } else {
    return github.head_commit.url;
  }
};

exports.author = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.user.login;
  } else {
    /*
      author:
         { username: 'btford',
           email: 'btford@umich.edu',
             name: 'Brian Ford' },
    */
    if (github && github.head_commit && github.head_commit.author) {
      return github.head_commit.author.name;
    } else {
      return '';
    }
  }
};

exports.runstatus = function() {
  if (this.errors) {
    return this.errors[0].message;
  } else {
    return this.state;
  }
};

exports.totaltime = function() {
  if (!this.updated) {
    this.updated = new Date().getTime();
  } 
  return convert((this.updated - this.created)/1000);
};

function convert(sec_num) {
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = Math.floor(sec_num - (hours * 3600) - (minutes * 60));

/*
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    */
    var time = seconds + ' sec';
    if (minutes) {
      time = minutes + ' min ' + time;
    }
    if (hours) {
      time = hours + ' hours ' + time;
    }
    return time;
}

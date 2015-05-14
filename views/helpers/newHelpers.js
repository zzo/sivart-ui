'use strict';

var path = require('path');

exports.overallBuildStatus = function() {
  var state = this.buildData.state || 'passed';
  if (state === 'building' || state === 'running') {
    state = 'started';
  }
  return state;
};

exports.branch = function() {
  return this.buildData.branch;
};

exports.comment = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.title;
  } else {
    return github.head_commit.message;
  }
};

exports.authorGravatarURL = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  return github.sender.avatar_url;
};

exports.authorName = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  console.log(github.head_commit.author);
  if (github.number) {
    return github.pull_request.user.login;
  } else {
    return github.pusher.name;
  }
};

exports.buildId = function() {
  return this.buildData.id;
};

exports.githubCommitURL = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    // TODO
//    return github.pull_request.html_url;
  } else {
    return github.head_commit.url;
  }
};

exports.githubCommitNumber = function() {
  var github = this.rawBuildRequest || this.buildInfo.rawBuildRequest;
  if (github.number) {
    //TODO!
      console.log(github);
//    return github.pull_request.html_url;
  } else {
    return github.after;
  }
};

exports.totalSeconds = function() {
  console.log(this);
  return Math.round(this.buildData.totalRunTime / 1000);
};

exports.totalRunningTime = function() {
  return convert(this.buildData.totalRunTime / 1000);
};

function convert(sec_num) {
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = Math.floor(sec_num - (hours * 3600) - (minutes * 60));

  var time = seconds + ' sec';
  if (minutes) {
    time = minutes + ' min ' + time;
  }
  if (hours) {
    time = hours + ' hours ' + time;
  }
  return time;
}

'use strict';

var path = require('path');

exports.compareURL = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.html_url;
  } else {
    return github.compare;
  }
};

exports.compareText = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.title;
  } else {
    return 'Compare ' + github.before.substring(0, 7) + '...' + github.after.substring(0, 7);
  }
};

exports.getBody = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.body;
  } else {
// TODO
    return github.head_commit.message;
  }
};

exports.runState = function() {
  var state = this.state;
  if (state === 'building' || state === 'running') {
    state = 'started';
  }
  if (state === 'errored' || state === 'timedout' || state === 'exited') {
    state = 'errored';
  }
  if (state === 'failed') {
    state = 'failed';
  }

  return state;
};

exports.crumbDisplay = function() {
  return this.buildId ? 'block' : 'none';
};

exports.active_current = function() {
  return this.type === 'Current' ? 'active' : '';
};

exports.active_push = function() {
  return this.type === 'Branches' ? 'active' : '';
};

exports.active_pull_requests = function() {
  return this.type === 'Pull Requests' ? 'active' : '';
};

exports.overallBuildStatus = function() {
  var state = this.buildData.state || 'passed';
  if (state === 'building' || state === 'running') {
    state = 'started';
  }
  return state;
};

exports.title = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return "PR #" + github.number;
  } else {
    return this.buildData.branch;
  }

};

exports.comment = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.pull_request.title;
  } else {
    return github.head_commit.message;
  }
};

exports.authorGravatarURL = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  return github.sender.avatar_url;
};

exports.authorName = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return github.sender.login;
  } else {
    return github.pusher.name;
  }
};

exports.runningOrRan = function() {
  var status = exports.overallBuildStatus.call(this);
  return (status === 'started') ? 'running' : 'ran';
};

exports.githubCommitURL = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    return path.join(github.repository.html_url, 'commit', github.pull_request.merge_commit_sha);
  } else {
    return github.head_commit.url;
  }
};

exports.githubCommitNumber = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  if (github.number) {
    //TODO!
      return github.pull_request.merge_commit_sha.substring(0, 7);
  } else {
    return github.after.substring(0, 7);
  }
};

exports.totalSeconds = function() {
  var total = this.buildData.totalRunTime;
  if (!total) {
    total = new Date().getTime() - this.buildData.created;
  }
  return Math.round(total / 1000);
};

exports.detailViewURL = function() {
  var github = this.rawBuildRequest;// || this.buildInfo.rawBuildRequest;
  var repoName = github.repository.full_name;
  return path.join('/', repoName, 'jobs', String(this.buildData.id));
};

exports.totalRunningTime = function() {
  var total = this.buildData.totalRunTime;
  if (!total) {
    total = new Date().getTime() - this.buildData.created;
  }
  return convert(total / 1000);
};

exports.timeStarted = function() {
  return new Date(this.buildData.created);
};

exports.timeStartedAgo = function() {
  var now = new Date().getTime();
  var diff = now - this.buildData.created;
  return convert(diff / 1000);
};

exports.allowedFailures = function() {
  return this.runs.reduce(function(previous, run) {
    return previous || run.ignoreFailure;
  }, false);
};

exports.getAllowedFailures = function() {
  return this.runs.map(function(run) {
    if (run.ignoreFailure) {
      return run;
    }
  });
};

exports.runTotalTime = function() {
  var updated = this.updated;
  if (!updated) {
    updated = new Date().getTime();
  }
  return convert((updated - this.created) / 1000);
};

function convert(sec_num) {
  var days = Math.floor(sec_num / 86400);
  var hours = Math.floor((sec_num - (days * 86400)) / 3600);
  var minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
  var seconds = Math.floor(sec_num - (days * 86400) -  (hours * 3600) - (minutes * 60));

  var time = seconds + ' sec';
  if (minutes) {
    time = minutes + ' min ' + time;
  }
  if (hours) {
    time = hours + ' hours ' + time;
  }
  if (days) {
    time = days + ' days ' + time;
  }

  return time;
}

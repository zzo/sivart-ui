var runsList;

$(function() {
  $("#runData").on('click', 'a.runRowItem', function() {
    var repoName = $(this).attr('data-repoName');
    var branch = $(this).attr('data-branch');
    var buildId = $(this).attr('data-buildId');
    var buildNumber = $(this).attr('data-buildNumber');
    var path = [repoName, 'jobs', branch, buildId, buildNumber].join('/');
    $.getJSON('/' + path, displayLog);
  });
});

function displayRunsList()  {
  var elem = $('#runData');
  elem.html(runsList);

  var crumb = $('#buildNumber_crumb');
  crumb.hide();

  var crumb = $('#buildId_crumb');
  crumb.addClass('active');
}

function displayLog(data)  {
  var elem = $('#runData');
  runsList = elem.html();
  var log = data.mainLog;

  var crumb = $('#buildNumber_crumb');
  crumb.html('Job #' + data.buildId + '.' + data.buildNumber);
  crumb.show();

  var crumb = $('#buildId_crumb');
  crumb.removeClass('active');
  crumb.show();
  crumb.html('Build #' + data.buildId);
  crumb.click(displayRunsList);

  //var data = elem.html();
  log = log.replace(/^-+ START ([^-]+) -+$/mg, '<h3>$1</h3><div>');
  log = log.replace(/^-+ END ([^-]+) -+$/mg, '</div>');
  log = log.replace(/<h3>Save Logs<\/h3>.+$/, '');

  var test = /--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\n--COMMAND (\w+): (.+): (\d+) seconds\n/;
  while (log.match(test)) {
    log = log.replace(test, fullCommand);
  }

  elem.html(log);

  function fullCommand(match, command ,logfile, startTime, commandStatus, commandAgain, seconds) {
    var status = commandStatus === 'SUCCEEDED' ? 'passed' : 'failed'
    return '<div data-buildNumber="' + data.buildNumber +'" class="command notloaded" data-logfile="' + logfile + '">'
    + '<li class="tile tile--jobs row list-unstyled ' + status + '">'
    + '<div class="tile-status tile-status--job">'
    +   '<span class="icon icon--job ' + status  + '"></span>'
    + '</div>'
    + '<p style="margin-left: 30px" class="job-ib jobs-item build-status">' 
    + command 
    + '</p><p class="job-duration jobs-item">' 
    + seconds 
    + ' seconds</p></li></div>';
  }

  // fetch log file or toggle if it's already there
  elem.on('click', '.command', function(e) {
    var me = $(this);
    var logfile = $(this).attr('data-logfile');
    var buildNumber = $(this).attr('data-buildNumber');
    if (me.hasClass('notloaded')) {
      var path = ['/getFile', data.repoName, data.branch, data.buildId, buildNumber, logfile].join('/');
      $.ajax(path).done(function(data) {
        var lines = data.split('\n');
        lines.shift();
        lines.pop();
        lines.pop();
        data = lines.join('\n');
        data = data.replace(/</g, '&lt;');
        if (data) {
          me.append('<pre>' + data + '</pre>');
        } else {
          me.append('<pre>No output</pre>');
        }
      });
      me.removeClass('notloaded');
    } else {
      me.children('pre').toggle();
    }
  });
}

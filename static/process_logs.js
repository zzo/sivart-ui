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

  if (data.status != 'running') {
    log = log.replace(/^-+ START ([^-]+) -+$/mg, '<h3>$1</h3><div>');
    log = log.replace(/^-+ END ([^-]+) -+$/mg, '</div>');
    log = log.replace(/<h3>Save Logs<\/h3>.+$/, '');
  
    var test = /--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\n([^]*?)--COMMAND (\w+): (.+): (\d+) seconds\n/;
    while (log.match(test)) {
      log = log.replace(test, fullCommand);
    }

    elem.html(log);

  } else {
    // live log info just dump the data
    var seen_length = log.length;
    log = log.replace(/</g, '&lt;');
    var html = '<pre class="commandOutput"><code>' + log + '</code></pre>';
    elem.html(html);

    function getMoreLog() {
      var path = [data.repoName, 'jobs', data.branch, data.buildId, data.buildNumber].join('/');
      $.getJSON('/' + path, function(data) {
        if (data.status === 'running') {
          contents = data.mainLog.slice(seen_length);
          seen_length += contents.length;
          contents = contents.replace(/</g, '&lt;');
          var code = elem.find('code');
          code.html(code.html() + contents);
          setTimeout(getMoreLog, 5000);
        } else {
          displayLog(data);
        }
      });
    }
    setTimeout(getMoreLog, 5000);
  }

  function fullCommand(match, command ,logfile, startTime, commandLog, commandStatus, commandAgain, seconds) {
    var status = commandStatus === 'SUCCEEDED' ? 'passed' : 'failed'
    commandLog = commandLog.replace(/</g, '&lt;');
    commandLog = commandLog || 'no output';

    return '<li class="command tile tile--jobs row list-unstyled ' + status + '">'
    + '<div class="tile-status tile-status--job">'
    +   '<span class="icon icon--job ' + status  + '"></span>'
    + '</div>'
    + '<p style="margin-left: 30px" class="job-ib jobs-item build-status">' 
    + command 
    + '</p><p class="job-duration jobs-item">' 
    + seconds 
    + ' seconds</p></li>'
    + '<pre class="commandOutput" style="display: none"><code>' + commandLog + '</code></pre>';
  }

  elem.on('click', '.command', function(e) {
    $(this).next().toggle();
  });

  elem.on('click', '.commandOutput', function(e) {
    $(this).toggle();
  });
}

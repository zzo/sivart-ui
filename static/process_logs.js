var runsList;
var runOutput = [];
var currentBuildNumber;
var currentBuildId;

$(function() {
  $("#runData").on('click', 'a', function() {
    var repoName = $(this).attr('data-repoName');
    var branch = $(this).attr('data-branch');
    var buildId = $(this).attr('data-buildId');
    var buildNumber = $(this).attr('data-buildNumber');
    var path = [repoName, 'jobs', branch, buildId, buildNumber].join('/');
    console.log(path);
    currentBuildNumber = buildNumber;
    currentBuildId = buildId;
    if (runOutput[currentBuildNumber]) {
      var elem = $('#runData');
      elem.html(runOutput[currentBuildNumber]);
    } else {
    console.log('JSON request');
      $.getJSON('/' + path, displayLog);
    }
  });
});

function displayRunsList()  {
  var elem = $('#runData');
  runOutput[currentBuildNumber] = elem.html();
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
    return '<span data-logfile="' + logfile + '" class="command notloaded"><span class="toggle">+</span>&nbsp;'
      + '<span class="command_line status_' + commandStatus +'">' 
      + command 
      + '</span>&nbsp;<span class="command_time">' 
      + seconds 
      + '&nbsp;seconds</span></span><br />';
  }

  /*
  $(elem).accordion({
    collapsible: true,
    heightStyle: "content"
  });
  */

  // fetch log file or toggle if it's already there
  elem.on('click', '.command', function(e) {
    var pieces = $(location).attr('pathname').split('/');
    var me = $(this);
    var logfile = $(this).attr('data-logfile');
    if (me.hasClass('notloaded')) {
      pieces.shift();
      var path = ['/getFile', data.repoName, data.branch, data.buildId, data.buildNumber, logfile].join('/');
      $.ajax(path).done(function(data) {
        var lines = data.split('\n');
        lines.shift();
        lines.pop();
        lines.pop();
        data = lines.join('\n');
        data = data.replace(/</g, '&lt;');
        me.append('<pre>' + data + '</pre>');
      });
      me.removeClass('notloaded');
      me.children('.toggle').html('-');
    } else {
      me.children('pre').toggle();
      var current = me.children('.toggle').html();
      var next = '-';
      if (current === '-') {
        next = '+';
      }
      me.children('.toggle').html(next);
    }
  });
}

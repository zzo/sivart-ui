var runsList;

$(function() {
  $("#runData").on('click', 'tr.runRowItem', function() {
    var repoName = $(this).attr('data-repoName');
    var branch = $(this).attr('data-branch');
    var buildId = $(this).attr('data-buildId');
    var buildNumber = $(this).attr('data-buildNumber');
    var path = [repoName, 'jobs', branch, buildId, buildNumber].join('/');
    $.getJSON('/' + path, displayLog);
  });

  $("#runData").on('click', 'span.redoRun', function(event) {
    event.stopImmediatePropagation();
    var dataElem = $(this).parent().parent();
    var repoName = dataElem.attr('data-repoName');
    var buildId = dataElem.attr('data-buildId');
    var buildNumber = dataElem.attr('data-buildNumber');
    var path = ['/redoRun', repoName, buildId, buildNumber].join('/');
    $.getJSON(path, function(data) {
      if (data.error) {
        // Bad Things
        console.log(data.error);
      } else {
        // just reload the page
        location.reload(true);
        // should ensure the row icon is now 'cancel'
      }
    });
  });

  $("#runData").on('click', 'span.cancelRun', function() {
    event.stopImmediatePropagation();
    var dataElem = $(this).parent().parent();
    var repoName = dataElem.attr('data-repoName');
    var buildId = dataElem.attr('data-buildId');
    var buildNumber = dataElem.attr('data-buildNumber');
    var path = ['/cancelRun', repoName, buildId, buildNumber].join('/');
    $.getJSON(path, function(data) {
      if (data.error) {
        // Bad Things
        console.log(data.error);
      } else {
        // just reload the page
        location.reload(true);
        // should ensure the row icon is now 'retry'
      }
    });
  });
});

function displayLog(data)  {
  var elem = $('#runData');
  setupEvents(elem, data);

  runsList = elem.html();
  var log = data.mainLog;

  var crumb = $('#buildNumber_crumb');
  crumb.html('Job #' + data.buildId + '.' + data.buildNumber);
  crumb.show();

  var crumb = $('#buildId_crumb');
  crumb.removeClass('active');
  crumb.show();
  crumb.html('Build #' + data.buildId);
  crumb.attr('href', '/' + data.repoName + '/jobs/' + data.buildId);

  if (data.status != 'running') {
    log = log.replace(/^-+ START ([^-]+) -+$/mg, '<h3>$1</h3><div>');
    log = log.replace(/^-+ END ([^-]+) -+$/mg, '</div>');
    log = log.replace(/<h3>Save Logs<\/h3>.+$/, ''); // last one blow it out
  
    var test = /--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\s+--COMMAND (\w+): (.+): (?:(\d+): )?(\d+) seconds\n?/;
    while (log.match(test)) {
      log = log.replace(test, fullCommand);
    }

    elem.html(log);

    // open last last file & scroll to it to see error immediately if there was a failure
    var failed = $('div[data-status=failed],div[data-status=errored],div[data-status=timedout],div[data-status=exited],div[data-status=system]');
    if (failed.length) {
      failed.trigger('click');
      $(document).ajaxComplete(function(event, xhr, settings)  {
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
        // keep scrolling to the bottom until we've got the file
        if (settings.url.match(/^\/getFile/)) {
          $(document).off('ajaxComplete');
        }
      });
    }

  } else {
    // live log info just dump the data
    var seen_length = log.length;
    log = log.replace(/</g, '&lt;');
    log = log.replace(//g, '');
    var html = '<pre class="ansi commandOutput"><code>' + getDeansiHtml(log) + '</code></pre>';
    elem.html(html);

    function getMoreLog() {
      var path = [data.repoName, 'jobs', data.branch, data.buildId, data.buildNumber].join('/');
      $.getJSON('/' + path, function(data) {
        if (data.status === 'running') {
          contents = data.mainLog.slice(seen_length);
          seen_length += contents.length;
          contents = contents.replace(/</g, '&lt;');
          contents = contents.replace(//g, '');
          var code = elem.find('code');
          code.html(code.html() + getDeansiHtml(contents));
          setTimeout(getMoreLog, 5000);
        } else {
          displayLog(data);
        }
      });
    }
    setTimeout(getMoreLog, 5000);
  }

  function fullCommand(match, command ,logfile, startTime, commandStatus, commandAgain, exitCode, seconds) {
    // here are all of the possible done run states (besides 'running' and 'building')
    var statusMap = {
      'passed': 'bg-success',
      'failed': 'bg-danger',
      'errored': 'bg-danger',
      'timedout': 'bg-danger',
      'exited': 'bg-danger',
      'system': 'bg-danger',
    };
    var iconMap = {
      'passed': 'check',
      'failed': 'x',
      'errored': 'alert',
      'timedout': 'clock',
      'exited': 'circle-slash',
      'system': 'server',
    };


    if (!seconds) {
      seconds = exitCode;
    }

    var logfileURL = 'https://storage.googleapis.com/' + data.baseURL + '/';

    return '<div data-logfile="' + logfile + '" '
      + 'data-buildNumber="' + data.buildNumber + '" data-status="' + commandStatus + '" '
      + 'class="notloaded command row ' + statusMap[commandStatus] + '">'
      + '<div class="col-md-1">'
      + '<span class="octicon octicon-' + iconMap[commandStatus]  + '"></span>'
      + '</div>'
      + '<div class="col-md-8">'
      + command
      + '</div>'
      + '<div class="col-md-2">'
      + seconds + ' seconds'
      + '</div>'
      + '<div class="col-md-1">'
      + '<a href="' + logfileURL + logfile + '" title="Download log file" target="_blank" style="cursor: pointer" class="octicon octicon-cloud-download" aria-hidden="true"></a>'
      + '</div>'
      + '</div>'
      + '<pre class="ansi commandOutput" style="display: none"><code></code></pre>'
  }
}

function setupEvents(elem, data) {
  elem.on('click', '.glyphicon-download', function(e) {
    var logfile = $(this).attr('data-logfile');
    var buildNumber = $(this).attr('data-buildNumber');
    e.stopPropagation();
  });

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
        data = data.replace(/</g, '&lt;') || 'no output';
        me.next().html(getDeansiHtml(data));
      });
      me.next().toggle();
      me.removeClass('notloaded');
    } else {
      me.next().toggle();
    }
  });
}

Deansi = {
  CLEAR_ANSI: /(?:\033)(?:\[0?c|\[[0356]n|\[7[lh]|\[\?25[lh]|\(B|H|\[(?:\d+(;\d+){,2})?G|\[(?:[12])?[JK]|[DM]|\[0K)/gm,
  apply: function(string) {
    var nodes,
      _this = this;
    if (!string) {
      return [];
    }
    string = string.replace(this.CLEAR_ANSI, '');
    nodes = ansiparse(string).map(function(part) {
      return _this.node(part);
    });
    return nodes;
  },
  node: function(part) {
    var classes, node;
    node = {
      type: 'span',
      text: part.text
    };
    if (classes = this.classes(part)) {
      node["class"] = classes.join(' ');
    }
    return node;
  },
  classes: function(part) {
    var result;
    result = [];
    result = result.concat(this.colors(part));
    if (result.length > 0) {
      return result;
    }
  },
  colors: function(part) {
    var colors;
    colors = [];
    if (part.foreground) {
      colors.push(part.foreground);
    }
    if (part.background) {
      colors.push("bg-" + part.background);
    }
    if (part.bold) {
      colors.push('bold');
    }
    if (part.italic) {
      colors.push('italic');
    }
    if (part.underline) {
      colors.push('underline');
    }
    return colors;
  },
  hidden: function(part) {
    if (part.text.match(/\r/)) {
      part.text = part.text.replace(/^.*\r/gm, '');
      return true;
    }
  }
};

function getDeansiHtml(string) {
  nodes = Deansi.apply(string);
  var html = '';
  nodes.forEach(function(node) {
    html += '<span class="' + (node.class || '') + '">' + node.text + '</span>';
  });
  return html;
}

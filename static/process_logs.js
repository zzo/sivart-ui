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
    log = log.replace(/<h3>Save Logs<\/h3>.+$/, '');
  
    var test = /--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\s+--COMMAND (\w+): (.+): (?:(\d+): )?(\d+) seconds\n?/;
    while (log.match(test)) {
      log = log.replace(test, fullCommand);
    }

    elem.html(log);

    // open last last file & scroll to it to see error immediately if there was a failure
    var failed = $('li.failed');
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
    log = log.split('\n').filter(function (s) { return s.match('startupscript:')}).join('\n');
    log = log.replace(/^[\s\S]+?startupscript: /mg, '');
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
          contents = contents.split('\n').filter(function (s) { return s.match('startupscript:')}).join('\n');
          contents = contents.replace(/^[\s\S]+?startupscript: /mg, '');
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
      'passed': 'passed',
      'failed': 'failed',
      'errored': 'errored',
      'timedout': 'failed',
      'exited': 'failed',
      'system': 'errored',
    };

    var status = statusMap[commandStatus];
    if (!seconds) {
      seconds = exitCode;
    }

    var logfileURL = 'https://storage.googleapis.com/' + data.baseURL + '/';
    var object = data.base
    return '<li data-logfile="' + logfile + '" '
      + 'data-buildNumber="' + data.buildNumber + '" '
      + 'class="notloaded command tile tile--jobs row list-unstyled ' + status + '">'
      + '<div class="tile-status tile-status--job">'
      +   '<span class="icon icon--job ' + status  + '"></span>'
      + '</div>'
      + '<p style="margin-left: 30px" class="job-ib jobs-item build-status">'
      + command
      + '</p><p class="job-duration jobs-item">'
      + '<a href="' + logfileURL + logfile + '" title="Download log file" target="_blank" style="cursor: pointer" class="glyphicon glyphicon-download" aria-hidden="true"></a>'
      + '</p><p class="job-duration jobs-item">'
      + seconds
      + ' seconds</p></li>'
      + '<pre class="ansi commandOutput" style="display: none"><code></code></pre>';
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

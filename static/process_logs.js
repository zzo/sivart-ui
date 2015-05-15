var elem = $('#mainData');

var data = elem.html();
data = data.replace(/^-+ START ([^-]+) -+$/mg, '<h3>$1</h3><div>');
data = data.replace(/^-+ END ([^-]+) -+$/mg, '</div>');
data = data.replace(/<h3>Save Logs<\/h3>.+$/, '');

var test = /--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\n--COMMAND (\w+): (.+): (\d+) seconds\n/;
while (data.match(test)) {
  data = data.replace(test, fullCommand);
}

elem.html(data);

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
    var path = ['/getFile', pieces[0], pieces[1], pieces[3], pieces[4], pieces[5], logfile].join('/');
    $.ajax(path).done(function(data) {
      var lines = data.split('\n');
      lines.shift();
      lines.pop();
      lines.pop();
      data = lines.join('\n');
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

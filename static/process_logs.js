var elem = $('#mainData');

var data = elem.html();
var commands = [];
data = data.replace(/^-+ START ([^-]+) -+$/mg, '<h3>$1</h3><div>');
data = data.replace(/^-+ END ([^-]+) -+$/mg, '</div>');
//data = data.replace(/^--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)$/mg, commandStart);
//data = data.replace(/$/mg, '<br />');
//data = data.replace(/^--COMMAND SUCCEEDED: ([^:]+): ([^:]+)$/mg, commandStart);

var test = /--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\n--COMMAND (\w+): (.+): (\d+) seconds\n/;
while (data.match(test)) {
  data = data.replace(/--COMMAND START: (.+): \/tmp\/sivart\/logs\/([^:]+): (.+)\n--COMMAND (\w+): (.+): (\d+) seconds\n/, fullCommand);
}
elem.html(data);

function fullCommand(match, command ,logfile, startTime, commandStatus, commandAgain, seconds) {
  commands.push(logfile);
  return '<span class="command status_' + commandStatus +'" id="' + logfile + '">' + command + '</span>&nbsp;<span class="command_time">' + seconds + '&nbsp;seconds </span><br />';
}

/*
commands.forEach(function(command) {
  console.log('accordian #' + command);
  $('#' + command).accordion({
    collapsible: true,
    heightStyle: "content"
  });
});
*/

$(elem).accordion({
  collapsible: true,
  heightStyle: "content"
});

elem.on('click', '.command', function(e) {
  var pieces = $(location).attr('pathname').split('/');
  var me = $(this);
  pieces.shift();
  console.log(pieces);
  var path = ['/getFile', pieces[0], pieces[1], pieces[3], pieces[4], pieces[5], $(this).attr('id')].join('/');
  console.log('PATH: ' + path);
  $.ajax(path).done(function(data) {
    var lines = data.split('\n');
    console.log(lines);
    lines.shift();
    lines.pop();
    lines.pop();
    data = lines.join('\n');
    me.append('<pre>' + data + '</pre>');
  });
});

function commandStart(fullmatch, command, logfile, startDate) {
//  var basename = logfile.replace(/^.*\/|\.[^.]*$/g, '') + '.log'
console.log('logfile: ' + logfile);
  commands.push(logfile);
  return '<span class="command" id="' + logfile + '">' + command + '</span>';
}

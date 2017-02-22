var template = __dirname + '/Runner.tmpl';

exports.process = function(grunt, task, context) {
  var source = grunt.file.read(template);
  var source =  grunt.util._.template(source)(context);
  grunt.log.writeln('Writing index.html');
  grunt.file.write('index.html', source);
  return source;
};

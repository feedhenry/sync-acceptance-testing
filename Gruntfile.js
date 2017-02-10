const connect = require('connect');
const serveStatic = require('serve-static');
const grunt = require('grunt');
var cloudServer;
var clientServer;

grunt.registerTask('startServers', function startServers() {
  process.env.FH_USE_LOCAL_DB = true;
  var done = this.async();
  cloudServer = require('./application.js').server;
  clientServer = connect().use(serveStatic(__dirname)).listen(9002, function(){
    console.log('server listening');
    return done();
  });
});

grunt.registerTask('stopServers', function stopServers() {
  if (clientServer) {
    clientServer.close();
  }
  if (cloudServer) {
    cloudServer.close();
  }
});

module.exports = function(grunt) {
  grunt.initConfig({
    jasmine: {
      all: {
        src: 'main.js',
        options: {
          host: 'http://localhost:9002',
          outfile: 'index.html?url=http://localhost:8001',
          spec: 'spec/*/**Spec.js'
        }
      }
    },
  });

  grunt.loadTasks('tasks');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.registerTask('default', ['startServers', 'jasmine', 'stopServers']);
};




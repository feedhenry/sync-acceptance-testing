const connect = require('connect');
const serveStatic = require('serve-static');
const grunt = require('grunt');
var cloudServer;
var clientServer;

grunt.registerTask('startServers', function startServers() {
  process.env.FH_USE_LOCAL_DB = true;
  const done = this.async();
  cloudServer = require('./application.js').server;
  clientServer = connect().use(serveStatic(__dirname)).listen(9002, function() {
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
          outfile: 'index.html?url=http://localhost:8001&throwFailures=true',
          specs: 'spec/*Spec.js',
          polyfills: [
            './node_modules/babel-polyfill/dist/polyfill.js'
          ],
          vendor: [
            './node_modules/jasmine-promises/dist/jasmine-promises.js'
          ],
          template: require('./tasks/template.js'),
          helpers: ['spec/helper.js'],
          keepRunner: true,
          summary: true
        }
      }
    },
    eslint: {
      target: ['app.js', 'application.js', 'spec/*.js']
    }
  });

  grunt.loadTasks('tasks');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.registerTask('default', ['eslint', 'startServers', 'jasmine', 'stopServers']);
};




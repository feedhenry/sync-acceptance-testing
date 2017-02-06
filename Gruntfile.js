// const path = require('path');
// const phantom = require('phantom');
// const url = path.join('http://localhost:9002/?url=http://localhost:8001');
const connect = require('connect');
const serveStatic = require('serve-static');
const grunt = require('grunt');
// const assert = require('assert');

// const phInstance;
// const pageInstance;

const cloudServer;
const clientServer;

grunt.registerTask('startServers', function startServers() {
  process.env.FH_USE_LOCAL_DB = true;
 var done = this.async();
 cloudServer = require('./application.js');
 // return done();
 clientServer = connect().use(serveStatic(__dirname)).listen(9002, function(){
    console.log('server listending');
    return done();
  });
});


//   phantom.create()
//       .then(instance => {
//           phInstance = instance;
//           return instance.createPage();
//       })
//       .then(page => {
//           pageInstance = page;
//           page.on('onConsoleMessage', function(msg, lineNum, sourceId) {
//           console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
//           });
//           page.on('onResourceError', function(resourceError) {
//               console.error(resourceError.url + ': ' + resourceError.errorString);
//           });
//           return page.open(url);
//       })
//       .then((status) => {
//           console.log('status', status);
//           return done();
//           //, arguments);
//           // page.evaluate(function() {
//           //     return document.getElementById('foo').innerHTML;
//           // }).then(function(html){
//           //     console.log(html);
//           // });
//       })
//       // .then(() => {
//       //     setTimeout(() => {
//       //         console.log('exiting phantom instance')
//       //         phInstance.exit();
//       //     }, 100000);

//       //     setTimeout(() => {
//       //         pageInstance.evaluate(function() {
//       //             const data = {
//       //                 "thing": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
//       //                 "created": new Date().getTime()
//       //             };
//       //             $fh.sync.doCreate('myShoppingList', data, console.log.bind(console.log), console.error.bind(console.error));
//       //         });
//       //     }, 3000);
//       // })
//       // .catch(error => {
//       //     console.log(error);
//       //     return done();
//       // });
//   });
// });

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

//     connect: {
//       return500: {
//         options: {
//           port: 10921,
//           middleware: function() {
//             return [function(req, res) {
//               res.statusCode = 500;
//               res.end();
//             }];
//           }
//         }
//       }
//     },
//     jshint: {
//       all: [
//         'Gruntfile.js',
//         'tasks/**/*.js',
//         'test/*.js',
//         'test/selfTest/*.js'
//       ],
//       options: {
//         jshintrc: '.jshintrc'
//       }
//     },
//     watch: {
//       dev: {
//         files: ['tasks/**/*'],
//         tasks: ['jasmine:pivotal:build']
//       }
//     },
//     jasmine: {
//       pivotal: {
//         src: 'test/fixtures/pivotal/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/pivotal/spec/*Spec.js',
//           helpers: 'test/fixtures/pivotal/spec/*Helper.js',
//           summary: true,
//           junit: {
//             path: 'junit'
//           }
//         }
//       },
//       phantomPolyfills: {
//         src: 'test/fixtures/phantom-polyfills/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/phantom-polyfills/spec/**/*.js'
//         }
//       },
//       consoleDisplayOptions: {
//         src: 'test/fixtures/pivotal/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/pivotal/spec/*Spec.js',
//           helpers: 'test/fixtures/pivotal/spec/*Helper.js',
//           display: 'short',
//           summary: true
//         }
//       },
//       consoleDisplayOptionsNone: {
//         src: 'test/fixtures/pivotal/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/pivotal/spec/*Spec.js',
//           helpers: 'test/fixtures/pivotal/spec/*Helper.js',
//           display: 'none',
//           summary: true
//         }
//       },
//       deepOutfile: {
//         src: 'test/fixtures/pivotal/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/pivotal/spec/*Spec.js',
//           helpers: 'test/fixtures/pivotal/spec/*Helper.js',
//           outfile: 'tmp/spec.html'
//         }
//       },
//       externalVendor: {
//         src: 'test/fixtures/externalVendor/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/externalVendor/spec/**/*.js',
//           vendor: 'http://code.jquery.com/jquery-1.10.1.min.js'
//         }
//       },
// // @todo: automate fail case here
// //      syntaxError: {
// //        src: 'test/fixtures/syntaxError/src/**/*.js',
// //        options: {
// //          specs: 'test/fixtures/syntaxError/spec/**/*.js'
// //        }
// //      },
//       customTemplate: {
//         src: 'test/fixtures/pivotal/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/pivotal/spec/*Spec.js',
//           helpers: 'test/fixtures/pivotal/spec/*Helper.js',
//           template: 'test/fixtures/customTemplate/custom.tmpl',
//           junit: {
//             path: 'junit/customTemplate',
//             consolidate: true
//           }
//         }
//       },
//       customTempDir: {
//         src: 'test/fixtures/custom-temp-dir/src/**/*.js',
//         options: {
//           specs: 'test/fixtures/custom-temp-dir/spec/**/*.js',
//           tempDir: '.custom/'
//         }
//       },
//       selfTest: {
//         options: {
//           specs: ['test/selfTest/*.js'],
//           '--web-security': 'no'
//         }
//       }
//     },


//     nodeunit: {
//       tasks: ['test/*_test.js']
//     }
  });

  grunt.loadTasks('tasks');

//   grunt.loadNpmTasks('grunt-contrib-jshint');
//   grunt.loadNpmTasks('grunt-contrib-watch');
//   grunt.loadNpmTasks('grunt-contrib-nodeunit');
//   grunt.loadNpmTasks('grunt-contrib-internal');
//   grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-jasmine');

//   grunt.registerTask('test', ['jshint', 'connect:return500', 'jasmine', 'nodeunit']);
  grunt.registerTask('default', ['startServers', 'jasmine', 'stopServers']);
};




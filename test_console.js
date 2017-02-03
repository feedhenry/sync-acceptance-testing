const path = require('path');
const phantom = require('phantom');
// const http = require('http');
const url = path.join('http://localhost:9002/?url=http://localhost:8001');
// http://localhost:9002/?url=http://localhost:8001

var phInstance;
var pageInstance;

process.env.FH_USE_LOCAL_DB=true;
var fh = require('./application.js').fh;

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(9002, function(){
    console.log('server listending');
    phantom.create()
        .then(instance => {
            phInstance = instance;
            return instance.createPage();
        })
        .then(page => {
            console.log
            pageInstance = page;
            page.on('onConsoleMessage', function(msg, lineNum, sourceId) {
            console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
            });
            page.on('onResourceError', function(resourceError) {
                console.error(resourceError.url + ': ' + resourceError.errorString);
            });
            return page.open(url);
        })
        .then((status) => {
            console.log('status', status);//, arguments);
            // page.evaluate(function() {
            //     return document.getElementById('foo').innerHTML;
            // }).then(function(html){
            //     console.log(html);
            // });
        })
        .then(() => {
            setTimeout(() => {
                console.log('exiting phantom instance')
                phInstance.exit();
            }, 100000);

            setTimeout(() => {
                pageInstance.evaluate(function() {
                    var data = {
                        "thing": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                        "created": new Date().getTime()
                    };
                    $fh.sync.doCreate('myShoppingList', data, console.log.bind(console.log), console.error.bind(console.error));
                });
            }, 3000);
        })
        .catch(error => {
            console.log(error);
            server.close();
            phInstance.exit();
        });
});
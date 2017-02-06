var $fh = require('fh-js-sdk');


console.log('TEST', $fh.sync);
        console.log('window.location.href', window.location.href);

var datasetId = 'myShoppingList';


$fh.sync.init({
  "do_console_log" : true,
  "storage_strategy" : "dom"
});

$fh.sync.notify(function(notification) {
  console.log('notify', notification);
});
var $fh = require('fh-js-sdk');


console.log('TEST', $fh.sync);

var datasetId = 'myShoppingList';


      $fh.sync.init({
        "do_console_log" : true,
        "storage_strategy" : "dom"
      });

      $fh.sync.manage(datasetId);
      $fh.sync.notify(function(notification) {
        console.log('notify', notification);
      });
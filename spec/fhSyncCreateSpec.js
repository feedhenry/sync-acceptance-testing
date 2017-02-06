// const url = path.join('http://localhost:9002/?url=http://localhost:8001');

var datasetId = 'myShoppingList';

describe('fh.sync manage and create', function() {
  beforeEach(function() {
    jasmine.clock().install();
  });

  afterEach(function() {
    jasmine.clock().uninstall();
  });

    it('should add a dataset and create a record', function(done) {
        console.log('window.location.href', window.location.href);



        console.log('waiting for init');
        // $fh.init(function(){
            setTimeout(function() {
  // Initialisation is now complete, you can now make $fh.cloud request
console.log('init success');




        console.log('manage');
  // invoke sync on dataset
    $fh.sync.manage(datasetId);
  // wait for next sync loop
      jasmine.clock().tick(10000);

        // verify the sync endpoint was called
console.log('TODO: verify sync called???');
setTimeout(function() {

        // create a record client
        console.log('create record')
        const data = {
            "thing": "IIIIIII",
            "created": new Date().getTime()
        };
        $fh.sync.doCreate(datasetId, data, console.log.bind(console.log), console.error.bind(console.error));
      jasmine.clock().tick(10000);

    console.log('TODO: waiting for sync')
    setTimeout(done, 2000);

      jasmine.clock().tick(2000);
}, 2000);

      jasmine.clock().tick(2000);

            }, 2000);
      jasmine.clock().tick(2000);






// }, function(err){
//   // Init failed
//   throw err;
// });
// return done();


        // verify they sync endpoint was called

        // verify the create handler was called

        // wait for next sync loop 

        // verify syncRecords is called

        // wait for next sync loop

        // verify the create is acknowledged
        
    });

});



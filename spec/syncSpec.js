const datasetId = 'specDataset';
const testData = { test: 'text' };
const updateData = { test: 'something else' };
var dataId;


function waitForSyncEvent(expectedEvent, cb) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.notify(function(event) {
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT', event.code, JSON.stringify(event));
        if (event.code === expectedEvent) {
          expect(event.code).toEqual(expectedEvent); // keep jasmine happy with at least 1 expectation
          console.log('!!!! cb', cb);
          if (cb) return cb(event, resolve, reject);
          return resolve();
        }
      });
    });
  };
}

describe('Sync', function() {

  beforeEach(function() {
    $fh.sync.init({ sync_frequency: 1, storage_strategy: 'dom' });
  });

  afterEach(function(done) {
    $fh.sync.stopSync(datasetId, done, done.fail);
  });

  it('should manage a dataset', function() {
    $fh.sync.manage(datasetId);
    return waitForSyncEvent('sync_complete')();
  });

  it('should list', function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.manage(datasetId, {}, {}, {}, function() {
        $fh.sync.doList(datasetId, resolve, function(code, msg) {
          return reject(code + ': ' + msg);
        });
      });
    })
    .then(waitForSyncEvent('sync_complete', function(event, resolve, reject) {
      // log: !!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT, sync_started, {"dataset_id":"specDataset","uid":null,"code":"sync_started","message":null}
      // log: !!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT, sync_complete, {"dataset_id":"specDataset","uid":"a2a57278171a23df4441b60238f7802a10e95970","code":"sync_complete","message":"online"}
      expect(event.dataset_id).toEqual(datasetId);
      return resolve();
    }));
  });

  it('should create', function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.manage(datasetId, {}, {}, {}, function() {
        $fh.sync.doCreate(datasetId, testData, function(res) {
          expect(res.action).toEqual('create');
          expect(res.post).toEqual(testData);
          return resolve();
        }, function(code, msg) {
          reject(code + ': ' + msg);
        });
      });
    })
    // .then(waitForSyncEvent('local_update_applied', function(event, resolve, reject) {
    //   // log: !!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT, local_update_applied, {"dataset_id":"specDataset","uid":null,"code":"local_update_applied","message":"create"}
    //   expect(event.dataset_id).toEqual(datasetId);
    //   expect(event.message).toEqual('create');
    //   return resolve();
    // }))
    // .then(waitForSyncEvent('remote_update_applied', function(event, resolve, reject) {
    //   // log: !!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT, remote_update_applied, {"dataset_id":"specDataset","uid":"589a5c0412c8015f559c1c90","code":"remote_update_applied","message":{"cuid":"B0CF358A9B46455184B26F2FD4DBA1AD","type":"applied","action":"create","hash":"80597a7628eb1d4ee196609c743ea6e759d8cbc6","uid":"589a5c0412c8015f559c1c90","msg":"''"}}
    //   expect(event.dataset_id).toEqual(datasetId);
    //   expect(event.message.type).toEqual('applied');
    //   expect(event.message.action).toEqual('create');
    //   return resolve();
    // }));
  });

  // it('should read', function() {
  //   return new Promise(function(resolve, reject) {
  //     $fh.sync.doRead(datasetId, dataId, function(data) {
  //       expect(data.data).toEqual(testData);
  //       resolve();
  //     }, function(code, msg) {
  //       reject(code + ': ' + msg);
  //     });
  //   });
  // });

  // it('should fail reading unknown uid', function() {
  //   return new Promise(function(resolve, reject) {
  //     $fh.sync.doRead(datasetId, 'nonsence', function(data) {
  //       reject(data);
  //     }, function(code) {
  //       expect(code).toBe('unknown_uid');
  //       resolve();
  //     });
  //   });
  // });

  // it('should update', function() {
  //   return new Promise(function(resolve, reject) {
  //     $fh.sync.doUpdate(datasetId, dataId, updateData, function() {
  //       $fh.sync.doRead(datasetId, dataId, function(data) {
  //         expect(data.data).toEqual(updateData);
  //         resolve();
  //       }, function(code, msg) {
  //         reject(code + ': ' + msg);
  //       });
  //     }, function(code, msg) {
  //       reject(code + ': ' + msg);
  //     });
  //   });
  // });

  // it('should delete', function() {
  //   return new Promise(function(resolve, reject) {
  //     $fh.sync.doDelete(datasetId, dataId, function() {
  //       $fh.sync.doList(datasetId, function(res) {
  //         expect(res).toEqual({});
  //         resolve();
  //       }, function(code, msg) {
  //         reject(code + ': ' + msg);
  //       });
  //     }, function(code, msg) {
  //       reject(code + ': ' + msg);
  //     });
  //   });
  // });

});
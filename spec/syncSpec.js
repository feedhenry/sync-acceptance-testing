const datasetId = 'specDataset';
const testData = { test: 'text' };
const updateData = { test: 'something else' };
var dataId;


function waitForSyncEvent(expectedEvent, cb) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.notify(function(event) {
        //console.log('!!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT', event.code, JSON.stringify(event));
        if (event.code === expectedEvent) {
          expect(event.code).toEqual(expectedEvent); // keep jasmine happy with at least 1 expectation
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
    .then(waitForSyncEvent('sync_started', function(event, resolve, reject) {
      expect(event.dataset_id).toEqual(datasetId);
      expect(event.message).toBeNull();
      return resolve();
    }))
    .then(waitForSyncEvent('sync_complete', function(event, resolve, reject) {
      expect(event.dataset_id).toEqual(datasetId);
      expect(event.message).toEqual('online');
      return resolve();
    }));
  });

  it('should create', function() {
    // set up a notifier that only handles `local_update_applied' events as these might
    // occur before the 'then' part of the following promise being called.
    $fh.sync.notify(function(event) {
      if (event.code === 'local_update_applied') {
        expect(event.dataset_id).toEqual(datasetId);
        expect(event.message).toMatch(/(load|create)/);
      }
    });
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
    .then(waitForSyncEvent('remote_update_applied', function(event, resolve, reject) {
       expect(event.dataset_id).toEqual(datasetId);
       expect(event.message.type).toEqual('applied');
       expect(event.message.action).toEqual('create');
       return resolve();
     }));
  });

  it('should read', function() {
    return new Promise(function manage(resolve, reject) {
      $fh.sync.manage(datasetId, {}, {}, {}, function() {
        return resolve();
      })
    }).then(function doCreate() {
      return new Promise(function(resolve, reject) {
        $fh.sync.doCreate(datasetId, testData, function(res) {
          return resolve(res);
        });
      });
    }).then(function doRead(res) {
      return new Promise(function(resolve, reject) {
        $fh.sync.doRead(datasetId, res.uid, function(data) {
            expect(data.data).toEqual(testData);
            expect(data.hash).not.toBeNull();
            return resolve();
        }, function failure(err) {
           reject(err);
        });
      });
    });
  });

  it('should fail when reading unknown uid', function() {
    return new Promise(function manage(resolve, reject) {
      $fh.sync.manage(datasetId, {}, {}, {}, function() {
        return resolve();
      })
    }).then(function doCreate() {
      return new Promise(function(resolve, reject) {
        $fh.sync.doCreate(datasetId, testData, function(res) {
          return resolve(res);
        });
      });
    }).then(function doRead(res) {
      return new Promise(function(resolve, reject) {
        $fh.sync.doRead(datasetId, 'bogus uid', function(data) {
          return reject('Item with uid ' + res.uid + '  should have been deleted');
        }, function failure(err) {
           expect(err).toEqual('unknown_uid');
           resolve();
        });
      });
    });
  });

  it('should update', function() {
    return manage()
    .then(doCreate)
    .then(doUpdate())
    .then(doRead())
    .then(function verifyUpdate(data) {
      expect(data.data).toEqual(updateData);
    })
    .catch(function (err) {
      expect(err).toBeNull();
    });
  });

  it('should delete', function() {
    return manage()
    .then(doCreate)
    .then(doDelete())
    .then(doRead())
    .catch(function (err) {
      expect(err).toEqual('unknown_uid');
    });
  });

});

function manage() {
  return new Promise(function (resolve, reject) {
    $fh.sync.manage(datasetId, {}, {}, {}, function() {
      return resolve();
    });
  });
}

function doCreate() {
  return new Promise(function(resolve, reject) {
    $fh.sync.doCreate(datasetId, testData, function(res) {
      return resolve(res);
    }, function (err) {
      reject(err);
    });
  });
}

function doDelete() {
  return function(res) {
    return new Promise(function(resolve, reject) {
      $fh.sync.doDelete(datasetId, res.uid, function() {
        return resolve(res);
      });
    });
  };
}

function doRead() {
  return function(res) {
    return new Promise(function(resolve, reject) {
      $fh.sync.doRead(datasetId, res.uid, function(data) {
        return resolve(data);
      }, function failure(err) {
        reject(err);
      });
    });
  };
}

function doUpdate() {
  return function(res) {
    return new Promise(function(resolve, reject) {
      $fh.sync.doUpdate(datasetId, res.uid, updateData, function() {
        return resolve(res);
      }, function (err) {
        reject(err);
      });
    });
  };
}

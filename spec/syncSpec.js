const datasetId = 'specDataset';
const testData = { test: 'text' };
const updateData = { test: 'something else' };
var dataId;


function waitForSyncEvent(expectedEvent) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.notify(function(event) {
        //console.log('!!!!!!!!!!!!!!!!!!!!!!!!!! SYNC_EVENT', event.code, JSON.stringify(event));
        if (event.code === expectedEvent) {
          expect(event.code).toEqual(expectedEvent); // keep jasmine happy with at least 1 expectation
          return resolve(event);
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
    return manage()
    .then(waitForSyncEvent('sync_started'))
    .then(function verifySyncStarted(event) {
      expect(event.dataset_id).toEqual(datasetId);
      expect(event.message).toBeNull();
    })
    .then(waitForSyncEvent('sync_complete'))
    .then(function verifySyncCompleted(event) {
      expect(event.dataset_id).toEqual(datasetId);
      expect(event.message).toEqual('online');
    });
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
    return manage()
    .then(doCreate)
    .then(function (res) {
      expect(res.action).toEqual('create');
      expect(res.post).toEqual(testData);
    })
    .then(waitForSyncEvent('remote_update_applied'))
    .then(function verifyUpdateApplied(event) {
       expect(event.dataset_id).toEqual(datasetId);
       expect(event.message.type).toEqual('applied');
       expect(event.message.action).toEqual('create');
     });
  });

  it('should read', function() {
    return manage()
    .then(doCreate)
    .then(doRead())
    .then(function (data) {
      expect(data.data).toEqual(testData);
      expect(data.hash).not.toBeNull();
    })
    .catch(function (err) {
      expect(err).toBeNull();
    });
  });

  it('should fail when reading unknown uid', function() {
    return manage()
    .then(doCreate)
    .then(doRead('bogus_uid'))
    .catch(function (err) {
      expect(err).toEqual('unknown_uid');
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

function doRead(uid) {
  return function(res) {
    return new Promise(function(resolve, reject) {
      $fh.sync.doRead(datasetId, uid || res.uid, function(data) {
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

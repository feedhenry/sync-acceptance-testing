const datasetId = 'specDataset';
const testData = { test: 'text' };
const updateData = { test: 'something else' };
const collisionData = { test: 'cause a collision' };

function waitForSyncEvent(expectedEvent) {
  return function() {
    return new Promise(function(resolve) {
      $fh.sync.notify(function(event) {
        if (event.code === expectedEvent) {
          expect(event.code).toEqual(expectedEvent); // keep jasmine happy with at least 1 expectation
          resolve(event);
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

  afterAll(function() {
    return new Promise(function(resolve, reject) {
      // We don't want to fail the test if the data isn't removed so resolve.
      $fh.cloud({ path: '/dataset/' + datasetId + '/reset' }, resolve, reject);
    });
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
    .then(function(res) {
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
    .then(function(data) {
      expect(data.data).toEqual(testData);
      expect(data.hash).not.toBeNull();
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should fail when reading unknown uid', function() {
    return manage()
    .then(doCreate)
    .then(doRead('bogus_uid'))
    .catch(function(err) {
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
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should delete', function() {
    return manage()
    .then(doCreate)
    .then(doDelete())
    .then(doRead())
    .catch(function(err) {
      expect(err).toEqual('unknown_uid');
    });
  });

  it('should cause a collision', function() {
    // The UID of the record which should have a collision.
    var recordId;

    return manage()
    .then(doCreate)
    .then(waitForSyncEvent('remote_update_applied'))
    .then(function verifyUpdateApplied(event) {
      // We need to store this for updating in MongoDB in the next step.
      recordId = event.message.uid;
      expect(recordId).not.toBeNull();
      return recordId;
    })
    .then(updateRecord)
    .then(doUpdate())
    .then(waitForSyncEvent('collision_detected'))
    .then(function verifyCorrectCollision(event) {
      // Assert that the collision is the one we caused.
      expect(event.message.uid).toEqual(recordId);
    })
    .then(listCollisions)
    .then(function verifyCollisionInList(collisions) {
      // Find the collision we invoked earlier.
      const invokedCollision = searchObject(collisions, function(collision) {
        return collision.uid === recordId;
      });
      // Assert that the collision is the one we caused.
      expect(invokedCollision).not.toBeNull();
      return invokedCollision;
    })
    .then(removeCollision)
    .then(listCollisions)
    .then(function(collisions) {
      // There should be no collisions left. We deleted the only one.
      expect(collisions).toEqual({});
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

});

function manage() {
  return new Promise(function(resolve) {
    $fh.sync.manage(datasetId, {}, {}, {}, function() {
      resolve();
    });
  });
}

function doCreate() {
  return new Promise(function(resolve, reject) {
    $fh.sync.doCreate(datasetId, testData, function(res) {
      resolve(res);
    }, function(err) {
      reject(err);
    });
  });
}

function doDelete() {
  return function(res) {
    return new Promise(function(resolve) {
      $fh.sync.doDelete(datasetId, res.uid, function() {
        resolve(res);
      });
    });
  };
}

function doRead(uid) {
  return function(res) {
    return new Promise(function(resolve, reject) {
      $fh.sync.doRead(datasetId, uid || res.uid, function(data) {
        resolve(data);
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
        resolve(res);
      }, function(err) {
        reject(err);
      });
    });
  };
}

function listCollisions() {
  return new Promise(function(resolve, reject) {
    $fh.sync.listCollisions(datasetId, function(collisions) {
      expect(collisions).not.toBeNull();
      resolve(collisions);
    }, function(err) {
      reject(err);
    });
  });
}

function removeCollision(collision) {
  return new Promise(function(resolve, reject) {
    $fh.sync.removeCollision(datasetId, collision.hash, resolve, reject);
  });
}

/**
 * Update the value of a record. Used to cause a collision.
 */
function updateRecord(uid) {
  return new Promise(function(resolve, reject) {

    const updatePath = '/dataset/' + datasetId + '/record/' + uid;
    const recordData = { data: collisionData };

    $fh.cloud({
      path: updatePath,
      data: recordData
    }, function() {
      resolve({ uid: uid });
    }, reject);
  });
}

/**
 * Iterate through the elements of an object and return the first element
 * which returns `true` for the `test` function argument.
 *
 * @param {Object} obj - The object to search.
 * @param {Function} test - The function to test each element with.
 * @returns {any} - The first element in `obj` which passed `test`.
 */
function searchObject(obj, test) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key) && test(obj[key])) {
      return obj[key];
    }
  }
}
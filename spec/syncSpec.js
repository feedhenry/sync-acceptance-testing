const datasetId = 'specDataset';
const testData = { test: 'text' };
const updateData = { test: 'something else' };

describe('Sync', function() {

  beforeAll(function(done) {
    $fh.cloud({
      path: '/datasets',
      data: {
        name: 'specDataset',
        options: { syncFrequency: 1 }
      }
    }, done, done.fail);
  });

  beforeEach(function() {
    $fh.sync.init({ sync_frequency: 1, storage_strategy: 'dom' , crashed_count_wait: 1});
  });

  afterEach(function(done) {
    $fh.sync.stopSync(datasetId, done, done.fail);
  });

  afterAll(function() {
    return removeDataset(datasetId)();
  });

  it('should cause a collision', function() {
    const collisionData = { test: 'cause a collision' };

    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(waitForSyncEvent('remote_update_applied'))
    .then(function verifyUpdateApplied(event) {
      // We need to store this for updating in MongoDB in the next step.
      expect(event.message.uid).not.toBeNull();
      // The UID of the record which should have a collision.
      var recordId = event.message.uid;
      return updateRecord(datasetId, recordId, collisionData)
      .then(doUpdate(datasetId, recordId , updateData))
      .then(waitForSyncEvent('collision_detected'))
      .then(function verifyCorrectCollision(event) {
        // Assert that the collision is the one we caused.
        expect(event.message.uid).toEqual(recordId);
      })
      .then(listCollisions(datasetId))
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
      .then(listCollisions(datasetId))
      .then(function verifyNoCollisions(collisions) {
        // There should be no collisions left. We deleted the only one.
        expect(collisions).toEqual({});
      })
      .catch(function(err) {
        expect(err).toBeNull();
      });
    });
  });

  it('should stop remote updates on stopSync', function() {
    // `local_update_applied` might be sent before `doCreate` finishes.
    $fh.sync.notify(function(event) {
      if (event.code === 'local_update_applied') {
        expect(event.dataset_id).toEqual(datasetId);
        expect(event.message).toMatch(/(load|create)/);
      }
    });

    return manage(datasetId)
    .then(stopSync(datasetId))
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      // Wait time to ensure `remote_update_applied` is called after online.
      return waitForSyncEvent('sync_complete')()
      .then(startSync(datasetId))
      .then(waitForSyncEvent('remote_update_applied'))
      .then(function verifyCorrectRecord(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should not stop remote updates using forceSync while sync not active', function() {
    // `local_update_applied` might be sent before `doCreate` finishes.
    $fh.sync.notify(function(event) {
      if (event.code === 'local_update_applied') {
        expect(event.dataset_id).toEqual(datasetId);
        expect(event.message).toMatch(/(load|create)/);
      }
    });

    return manage(datasetId)
    .then(stopSync(datasetId))
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      // Wait time to ensure `remote_update_applied` is called after online.
      return waitForSyncEvent('sync_complete')()
      .then(forceSync(datasetId))
      .then(waitForSyncEvent('remote_update_applied'))
      .then(function verifyCorrectRecord(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should sync after client goes offline', function() {
    $fh.sync.notify(function(event) {
      if (event.code === 'offline_update') {
        expect(event.dataset_id).toEqual(datasetId);
        expect(event.message).toEqual('update');
      }
    });

    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(function(res) {
      const uid = res.uid;
      return doUpdate(datasetId, uid, updateData)
        .then(doRead(datasetId, uid))
        .then(function verifyUpdate(data) {
          expect(data).toEqual(updateData);
        })
        .then(offline())
        .then(doUpdate(datasetId, uid, updateData))
        .then(online())
        .then(doRead(datasetId, uid))
        .then(waitForSyncEvent('remote_update_applied'));
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should handle crashed records', function() {
    return setServerStatus({ crashed: true })()
    .then(manage(datasetId, { sync_frequency: 2 }))
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      // Wait twice to ensure record was included in pending at the time.
      return waitForSyncEvent('sync_failed')()
      .then(waitForSyncEvent('sync_failed'))
      .then(getPending(datasetId))
      .then(function verifyPendingRecordCrashed(pending) {
        expect(pending[record.hash].inFlight).toBe(true);
        expect(pending[record.hash].crashed).toBe(true);
      })
      .then(setServerStatus({ crashed: false }))
      .then(waitForSyncEvent('remote_update_applied'))
      .then(function verifyCorrectRecordApplied(event) {
        // A record has been applied, check that its our record.
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      })
      .then(getPending(datasetId))
      .then(function verifyNoPending(pending) {
        expect(pending).toEqual({});
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should remove dataset when clearCache is called', function() {
    return manage(datasetId)
      .then(doCreate(datasetId, testData))
      .then(function withResult(res) {
        const uid = res.uid;
        return clearCache(datasetId)
          .then(doRead(datasetId, uid)
          .catch(function(err) {
            expect(err).toEqual('unknown_dataset ' + datasetId);
          })
          .then(manage(datasetId))); // this is to keep afterEach from failing
      });
  });

  it('should update uid after remote update', function() {
    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      return new Promise(function verifyUidIsHash(resolve) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(record.hash).toEqual(recordUid);
        resolve();
      })
      .then(waitForSyncEvent('remote_update_applied'))
      .then(function verifyUidIsUpdated(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });
});

function offline() {
  return setOnline(false);
}

function online() {
  return setOnline(true);
}

function setOnline(online) {
  return new Promise(function(resolve) {
    navigator.network = navigator.network || {};
    navigator.network.connection = navigator.network.connection || {};
    navigator.network.connection.type = online ? 'WiFi' : 'none';
    resolve(online);
  });
}

function manage(dataset, options) {
  return new Promise(function(resolve) {
    $fh.sync.manage(dataset, options, {}, {}, function() {
      resolve();
    });
  });
}

function clearCache(datasetId) {
  return new Promise(function(resolve) {
    $fh.sync.clearCache(datasetId, function() {
      return resolve('cleared');
    });
  });
}

function doCreate(dataset, data) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.doCreate(dataset, data, function(res) {
        resolve(res);
      }, function(err) {
        reject(err);
      });
    });
  };
}

function doRead(datasetId, uid) {
  return new Promise(function(resolve, reject) {
    $fh.sync.doRead(datasetId, uid, function(data) {
      resolve(data);
    }, function failure(err) {
      reject(err);
    });
  });
}

function doUpdate(datasetId, uid, updateData) {
  return new Promise(function(resolve, reject) {
    $fh.sync.doUpdate(datasetId, uid, updateData, function() {
      resolve(updateData);
    }, function(err) {
      reject(err);
    });
  });
}

function listCollisions(datasetId) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.listCollisions(datasetId, function(collisions) {
        expect(collisions).not.toBeNull();
        resolve(collisions);
      }, function(err) {
        reject(err);
      });
    });
  };
}

function removeCollision(collision) {
  return new Promise(function(resolve, reject) {
    $fh.sync.removeCollision(datasetId, collision.hash, resolve, reject);
  });
}

function getPending(dataset) {
  return function() {
    return new Promise(function(resolve) {
      $fh.sync.getPending(dataset, resolve);
    });
  };
}

/**
 * Update the value of a record. Used to cause a collision.
 */
function updateRecord(dataset, uid, record) {
  return new Promise(function(resolve, reject) {

    const updatePath = '/datasets/' + dataset + '/records/' + uid;
    const recordData = { data: record };

    $fh.cloud({
      path: updatePath,
      data: recordData,
      method: 'put'
    }, function() {
      resolve({ uid: uid });
    }, reject);
  });
}

/**
 * Empty all collections in MongoDB which correspond to a particular dataset.
 *
 * @param {string} dataset - The name of the dataset to remove collections for.
 */
function removeDataset(dataset) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.cloud({ path: '/datasets/' + dataset + '/reset' }, resolve, reject);
    });
  };
}

/**
 * Start sync for a specified dataset.
 *
 * @param {string} dataset - The dataset to start syncing.
 */
function startSync(dataset) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.startSync(dataset, resolve, reject);
    });
  };
}

/**
 * Force sync for a particular dataset. Even if sync is inactive.
 *
 * @param {string} dataset - The name of the dataset to force a sync on.
 */
function forceSync(dataset) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.forceSync(dataset, resolve, reject);
    });
  };
}

/**
 * Stop sync for a specified dataset. Only local updates will be applied.
 *
 * @param {string} dataset - The dataset to stop syncing.
 */
function stopSync(dataset) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.stopSync(dataset, resolve, reject);
    });
  };
}

/**
 * Wait for a specific notification to be made from the client SDK.
 *
 * @param {string} expectedEvent - The name of the event to wait for.
 */
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

/**
 * Set the server into or out of a crashed state with a custom response status.
 *
 * @param {Object} status - The status object.
 * @param {boolean} status.crashed - If the server should act as crashed.
 * @param {number} status.crashStatus - If crashed, what status code to use.
 */
function setServerStatus(status) {
  const serverStatus = { status: status };
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.cloud({
        path: '/server/status',
        data: serverStatus
      }, resolve, reject);
    });
  };
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


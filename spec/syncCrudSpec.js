const datasetId = 'specDataset';
const testData = { test: 'text' };
const updateData = { test: 'something else' };

describe('Sync Create/Update/Delete', function() {

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

  it('should manage a dataset', function() {
    $fh.sync.manage(datasetId);
    return waitForSyncEvent('sync_complete')();
  });

  it('should list', function() {
    return manage(datasetId)
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
    return manage(datasetId)
    .then(doCreate(datasetId, testData))
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
    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(function withResult(res) {
      const uid = res.uid;
      return doRead(datasetId, uid)
      .then(function verifyData(data) {
        expect(data.data).toEqual(testData);
        expect(data.hash).not.toBeNull();
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should fail when reading unknown uid', function() {
    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(function withResult() {
      return doRead(datasetId, 'bogus_uid');
    })
    .catch(function verifyError(err) {
      expect(err).toEqual('unknown_uid');
    });
  });

  it('should update', function() {
    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(function withResult(res) {
      const uid = res.uid;
      return doUpdate(datasetId, uid, updateData)
      .then(doRead(datasetId, uid))
      .then(function verifyUpdate(data) {
        expect(data).toEqual(updateData);
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should delete', function() {
    return manage(datasetId)
      .then(doCreate(datasetId, testData))
      .then(function withResult(res) {
        const uid = res.uid;
        return doDelete(datasetId, uid)
        .then(doRead(datasetId, uid).catch(function(err) {
          expect(err).toEqual('unknown_uid');
        }));
      });
  });

  it('should create records created by other clients', function() {
    const recordToCreate = { test: 'create' };

    return manage(datasetId)
    .then(createRecord(datasetId, recordToCreate))
    .then(waitForSyncEvent('record_delta_received'))
    .then(function verifyDeltaStructure(event) {
      expect(event.uid).not.toBeNull();
      expect(event.message).toEqual('create');
      expect(event.dataset_id).toEqual(datasetId);
      return doRead(datasetId, event.uid)
      .then(function verifyCorrectRecordApplied(record) {
        expect(record.data).toEqual(recordToCreate);
      })
      .catch(function(err) {
        expect(err).toBeNull();
      });
    });
  });

  it('should update records updated by other clients', function() {
    const updateData = { test: 'cause a client update' };

    return manage(datasetId)
    .then(doCreate(datasetId, testData))
    .then(waitForSyncEvent('remote_update_applied'))
    .then(function verifyUpdateApplied(event) {
      const uid = event.uid;
      return updateRecord(datasetId, uid, updateData)
      .then(waitForSyncEvent('record_delta_received'))
      .then(function verifyDeltaStructure(event) {
        expect(event.message).toEqual('update');
        return doRead(datasetId, event.uid);
      })
      .then(function verifyRecordUpdated(record) {
        expect(record.data).toEqual(updateData);
      });
    })
    .catch(function(err) {
      expect(err).toBeNull();
    });
  });

  it('should manage multiple datasets', function() {
    const datasetOneId = 'specDatasetOne';
    const datasetTwoId = 'specDatasetTwo';

    const recordOne = { test: 'recordOne' };
    const recordTwo = { test: 'recordTwo' };
    // We will use these to get the record from `doList` later.
    var recordOneHash;
    var recordTwoHash;

    return manage(datasetOneId)
    .then(manage(datasetTwoId))
    .then(doCreate(datasetOneId, recordOne))
    .then(waitForSyncEvent('remote_update_applied'))
    .then(function setRecordTwoHash(event) {
      expect(event.uid).not.toBeNull();
      recordOneHash = event.uid;
    })
    .then(doCreate(datasetTwoId, recordTwo))
    .then(waitForSyncEvent('remote_update_applied'))
    .then(function setRecordTwoHash(event) {
      expect(event.uid).not.toBeNull();
      recordTwoHash = event.uid;
    })
    .then(doList(datasetOneId))
    .then(function verifyDatasetOneUpdates(records) {
      expect(records[recordTwoHash]).not.toBeDefined();
      expect(records[recordOneHash]).not.toBeNull();
      expect(records[recordOneHash].data).toEqual(recordOne);
    })
    .then(doList(datasetTwoId))
    .then(function verifyDatasetTwoUpdates(records) {
      expect(records[recordOneHash]).not.toBeDefined();
      expect(records[recordTwoHash]).not.toBeNull();
      expect(records[recordTwoHash].data).toEqual(recordTwo);
    })
    .then(removeDataset(datasetOneId))
    .then(removeDataset(datasetTwoId))
    .catch(function(err) {
      expect(err).toBeNull();
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

function manage(dataset, options) {
  return new Promise(function(resolve) {
    $fh.sync.manage(dataset, options, {}, {}, function() {
      resolve();
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

function doDelete(datasetId, uid) {
  return new Promise(function(resolve, reject) {
    $fh.sync.doDelete(datasetId, uid, function() {
      resolve(true);
    }, function failure(err) {
      reject(err);
    });
  });
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

function doList(dataset) {
  return function() {
    return new Promise(function(resolve, reject) {
      $fh.sync.doList(dataset, function(res) {
        resolve(res);
      }, reject);
    });
  };
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
 * Create a record in the database, avoiding sync.
 *
 * @param {Object} record - The record to create.
 */
function createRecord(dataset, record) {
  return function() {
    return new Promise(function(resolve, reject) {
      const createPath = '/datasets/' + dataset + '/records';
      const recordData = { data: record };

      $fh.cloud({
        path: createPath,
        data: recordData
      }, resolve, reject);
    });
  };
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

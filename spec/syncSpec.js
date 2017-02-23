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
      return startSync(datasetId)()
      .then(waitForSyncEvent('remote_update_applied'))
      .then(function verifyCorrectRecord(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      });
    })
    .then(removeDataset(datasetId))
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
    .then(function(inflightRecord) {
      return forceSync(datasetId)()
      .then(waitForSyncEvent('sync_complete'))
      // doing two sync as the server can not respond early with no updates.
      .then(forceSync(datasetId))
      .then(waitForSyncEvent('remote_update_applied'))
      .then(function verifyCorrectRecord(event) {
        expect(event.uid).toEqual(inflightRecord.uid);
      });
    })
    .then(startSync(datasetId))
    .then(removeDataset(datasetId))
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

  it('should handle crashed server after immediate response', function() {
    return manage(datasetId, { sync_frequency: 2 })
    .then(waitForSyncEvent('sync_started'))
    .then(setServerStatus({ crashed: true }))
    .then(getPending(datasetId))
    .then(function verifyPendingRecordCrashed(pending) {
      expect(pending).toEqual({});
    })
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

});


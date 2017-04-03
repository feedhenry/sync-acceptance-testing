const testData = { test: 'text' };
const updateData = { test: 'something else' };
var currentDatasetIds = [];

describe('Sync', function() {

  beforeAll(function() {
    localStorage.clear();
  });

  beforeEach(function() {
    currentDatasetIds = [];
    $fh.sync.init({ sync_frequency: 0.5, storage_strategy: 'dom' , crashed_count_wait: 1});
  });

  afterEach(function(done) {
    localStorage.clear();

    if (currentDatasetIds.length === 0) {
      return done();
    }

    var datasetsStopped = 0;

    function datasetStopped() {
      datasetsStopped++;
      if (datasetsStopped === currentDatasetIds.length) {
        localStorage.clear();
        return done();
      }
    }

    // Stop any managed datasets
    currentDatasetIds.forEach(function(dataset) {
      $fh.sync.stopSync(dataset, function() {
        datasetStopped();
      }, function() {
        // ignore any errors
        datasetStopped();
      });
    });
  });

  afterAll(function() {
    currentDatasetIds.forEach(function(datasetId) {
      removeDataset(datasetId)();
    });
  });

  it('should cause a collision', function() {
    const datasetId = 'shoudCauseCollision';
    currentDatasetIds.push(datasetId);
    const collisionData = { test: 'cause a collision' };

    return manage(datasetId)()
    .then(doCreate(datasetId, testData))
    .then(waitForSyncEvent('remote_update_applied', datasetId))
    .then(function verifyUpdateApplied(event) {
      // We need to store this for updating in MongoDB in the next step.
      expect(event.message.uid).not.toBeNull();
      // The UID of the record which should have a collision.
      var recordId = event.message.uid;
      return updateRecord(datasetId, recordId, collisionData)()
      .then(doUpdate(datasetId, recordId , updateData))
      .then(waitForSyncEvent('collision_detected', datasetId))
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
      .then(function removeCollision(collision) {
        return new Promise(function(resolve, reject) {
          $fh.sync.removeCollision(datasetId, collision.hash, resolve, reject);
        });
      })
      .then(listCollisions(datasetId))
      .then(function verifyNoCollisions(collisions) {
        // There should be no collisions left. We deleted the only one.
        expect(collisions).toEqual({});
      })
      .catch(function(err) {
        console.error(err, err.stack);
        expect(err).toBeNull();
      });
    });
  });

  it('should cause a collision when coming online', function() {
    const datasetId = 'shoudCauseCollisionOffline';
    currentDatasetIds.push(datasetId);
    const collisionData = { test: 'cause a collision' };

    return manage(datasetId, { sync_frequency: 0.5 })()
    .then(doCreate(datasetId, testData))
    .then(waitForSyncEvent('remote_update_applied', datasetId))
    .then(function verifyUpdateApplied(event) {
      // We need to store this for updating in MongoDB in the next step.
      expect(event.message.uid).not.toBeNull();
      // The UID of the record which should have a collision.
      const recordId = event.message.uid;
      return offline()
      .then(updateRecord(datasetId, recordId, collisionData))
      .then(waitForSyncEvent('sync_failed', datasetId))
      .then(doUpdate(datasetId, recordId , updateData))
      .then(waitForSyncEvent('sync_failed', datasetId))
      .then(online)
      .then(waitForSyncEvent('record_delta_received', datasetId))
      .then(doList(datasetId))
      .then(function(records) {
        const record = records[event.message.uid];
        expect(record).toBeDefined();
        expect(record.data.test).toEqual(collisionData.test);
      })
      .catch(function(err) {
        console.error(err, err.stack);
        expect(err).toBeNull();
      });
    });
  });

  it('should stop remote updates on stopSync', function() {
    const datasetId = 'shoudStopRemoteUpdatesOnStopSync';
    currentDatasetIds.push(datasetId);

    return manage(datasetId)()
    .then(stopSync(datasetId))
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      // Wait time to ensure `remote_update_applied` is called after online.
      return verifyAbsenceOfEvents(['sync_complete', 'remote_update_applied'], datasetId, 1500)()
      .then(startSync(datasetId))
      .then(waitForSyncEvent('sync_started', datasetId))
      .then(waitForSyncEvent('remote_update_applied', datasetId))
      .then(function verifyCorrectRecord(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      })
      // wait for sync_complete to ensure the sync loop finishes before moving onto other tests
      // potentially affecting them
      .then(waitForSyncEvent('sync_complete', datasetId));
    })
    .catch(function(err) {
      console.error(err, err.stack);
      expect(err).toBeNull();
    });
  });

  it('should not stop remote updates using forceSync while sync not active', function() {
    const datasetId = 'shoudNotStopRemoteUpdatesUsingForcesyncWhileNotActive';
    currentDatasetIds.push(datasetId);

    return manage(datasetId)()
    .then(stopSync(datasetId))
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      const recordUid = $fh.sync.getUID(record.hash);
      // Wait time to ensure `remote_update_applied` is called after online.
      return verifyAbsenceOfEvents(['sync_complete', 'remote_update_applied'], datasetId, 1500)()
      .then(forceSync(datasetId))
      .then(waitForSyncEvent('sync_complete', datasetId))
      .then(function() {
        return new Promise(function(resolve) {
          // wait enough time for sync loop on client & sync server to process the update
          setTimeout(resolve, 1500);
        });
      })
      // TLDR: Do a second update & sync to ensure we get at least 1 remote_update_applied event
      //
      // To make this test work for <=6 & >6 fh-mbaas-api versions,
      // we do another update that will trigger a remote_update_applied.
      // In older code 2 events will trigger, 1 for create & 1 for update.
      // This is OK as we just need 1 to continue.
      // In newer code 1 event will trigger for create due to server doing deferred processing.
      // The update event will happen at a later point, but we're not interested in it then.
      .then(function updateRecord() {
        return doUpdate(datasetId, recordUid, updateData)();
      })
      .then(forceSync(datasetId)) // Do a second forceSync so we hear about our create/update
      .then(waitForSyncEvent('remote_update_applied', datasetId))
      .then(function verifyCorrectRecord(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      });
    })
    .catch(function(err) {
      console.error(err, err.stack);
      expect(err).toBeNull();
    });
  });

  it('should sync after client goes offline', function() {
    const datasetId = 'shoudSyncAfterClientGoesOffline';
    currentDatasetIds.push(datasetId);
    $fh.sync.notify(function(event) {
      if (event.dataset_id === datasetId && event.code === 'offline_update') {
        expect(event.dataset_id).toEqual(datasetId);
        expect(event.message).toEqual('update');
      }
    });

    return manage(datasetId)()
    .then(doCreate(datasetId, testData))
    .then(function(res) {
      const uid = res.uid;
      return doUpdate(datasetId, uid, updateData)()
        .then(doRead(datasetId, uid))
        .then(function verifyUpdate(data) {
          expect(data).toEqual(updateData);
        })
        .then(offline)
        .then(doUpdate(datasetId, uid, updateData))
        .then(online)
        .then(doRead(datasetId, uid))
        .then(waitForSyncEvent('remote_update_applied', datasetId));
    })
    .catch(function(err) {
      console.error(err, err.stack);
      expect(err).toBeNull();
    });
  });

  it('should handle crashed records', function() {
    const datasetId = 'shoudHandleCrashedRecords';
    currentDatasetIds.push(datasetId);
    return setServerStatus({ crashed: true })()
    .then(manage(datasetId))
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      // Wait twice to ensure record was included in pending at the time.
      return waitForSyncEvent('sync_failed', datasetId)()
      .then(waitForSyncEvent('sync_failed', datasetId))
      .then(getPending(datasetId))
      .then(function verifyPendingRecordCrashed(pending) {
        expect(pending[record.hash].inFlight).toBe(true);
        expect(pending[record.hash].crashed).toBe(true);
      })
      .then(setServerStatus({ crashed: false }))
      .then(waitForSyncEvent('remote_update_applied', datasetId))
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
    const datasetId = 'shoudRemoveDatasetWhenClearCacheIsCalled';
    currentDatasetIds.push(datasetId);
    return manage(datasetId)()
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
    const datasetId = 'shoudUpdateUIDAfterRemoteUpdate';
    currentDatasetIds.push(datasetId);
    return manage(datasetId)()
    .then(doCreate(datasetId, testData))
    .then(function(record) {
      return new Promise(function verifyUidIsHash(resolve) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(record.hash).toEqual(recordUid);
        resolve();
      })
      .then(waitForSyncEvent('remote_update_applied', datasetId))
      .then(function verifyUidIsUpdated(event) {
        const recordUid = $fh.sync.getUID(record.hash);
        expect(event.uid).toEqual(recordUid);
      });
    })
    .catch(function(err) {
      console.error(err, err.stack);
      expect(err).toBeNull();
    });
  });
});

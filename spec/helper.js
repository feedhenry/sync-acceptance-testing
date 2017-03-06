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
 * Verifies the given events are not seen/notified for the specific number of milliseconds
 *
 * @param {string[]} events event names to verify do not occur
 * @param {number} timeout time to wait before the verification is complete
 */
function verifyAbsenceOfEvents(events, timeout) {
  return function() {
    return new Promise(function(resolve, reject) {
      // resolve if the specified amount of time has passed,
      // and prevent rejection being called by removing our notification listener
      var resolveTimeout = setTimeout(function() {
        $fh.sync.notify(function() {});
        resolve();
      }, timeout);

      // reject if any of the specified events are seen, and clear the resolve timeout to
      // prevent resolution
      $fh.sync.notify(function(event) {
        if (events.indexOf(event.code) > -1) {
          clearTimeout(resolveTimeout);
          $fh.sync.notify(function() {});
          return reject('Event was seen when it shouldn\'t have been (' + event.code + ')');
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

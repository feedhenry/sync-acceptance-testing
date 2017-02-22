const async = require('async');
const bodyParser = require('body-parser');
const mbaasApi = require('fh-mbaas-api');
const express = require('express');
const mbaasExpress = mbaasApi.mbaasExpress();
const cors = require('cors');

const app = express();

// Used to check whether the server should respond.
const serverStatus = {
  crashed: false,
  forcedResponse: null
};

// Enable CORS for all requests
app.use(cors());

// Use JSON body parser for all requests
app.use(bodyParser.json());

// Check if the server is currently set to crash for all requests.
app.use(function crashIfNeeded(req, res, next) {
  const isSyncRoute = req.originalUrl.indexOf('mbaas/sync') !== -1;
  if (isSyncRoute && serverStatus.crashed) {
    return res.status(403).end();
  } else if (isSyncRoute && serverStatus.forcedResponse) {
    return res.json(serverStatus.forcedResponse).status(200);
  } else {
    next();
  }
});

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys([]));
app.use('/mbaas', mbaasExpress.mbaas);

// allow serving of static files from the public directory
app.use(express.static(__dirname + '/public'));

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());

app.post('/server/status', updateStatus);
app.post('/datasets/:datasetId/reset', resetDataset);
app.post('/datasets', createDataset);
app.post('/datasets/:datasetId/records', createRecord);
app.put('/datasets/:datasetId/records/:recordId', updateRecord);

// Important that this is last!
app.use(mbaasExpress.errorHandler());

var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
var server = app.listen(port, host, function() {
});

/**
 * Request handler to delete all collections in MongoDB for a provided dataset.
 */
function resetDataset(req, res) {
  // Define titles for default, updates and collision collections in MongoDB.
  const dataset = req.params.datasetId;
  const updates = dataset + '-updates';
  const collisions = dataset + '_collision';

  // Delete all records in the MongoDB collections for the dataset.
  async.forEach([dataset, updates, collisions], function(collection, cb) {
    // If this fails we don't want the test to fail.
    resetCollection(collection, cb);
  }, function(err) {
    if (err) {
      return res.json({error: err }).status(500);
    }
    return res.json({message: 'Dataset ' + dataset + ' reset'}).status(200);
  });
}

/**
 * Remove all records for a particular collection in MongoDB.
 *
 * @param {string} collection - Name of the MongoDB collection.
 * @param {Function} cb - Callback function.
 */
function resetCollection(collection, cb) {
  mbaasApi.db({
    act: 'deleteall',
    type: collection
  }, cb);
}

module.exports = {
  app: app,
  server: server
};

/**
 * Update a record in a particular dataset. Used to cause a collision.
 */
function updateRecord(req, res) {

  const dataset = req.params.datasetId;
  const record = req.params.recordId;
  const recordData = req.body.data;

  mbaasApi.db({
    act: 'update',
    type: dataset,
    guid: record,
    fields: recordData
  }, function(err, data) {
    if (err) {
      return res.json({ error: err }).status(500);
    }
    return res.json({ data: data }).status(200);
  });
}

/**
 * Create a record in a particular dataset.
 */
function createRecord(req, res) {
  const dataset = req.params.datasetId;
  const recordData = req.body.data;

  mbaasApi.db({
    act: 'create',
    type: dataset,
    fields: recordData
  }, function(err, data) {
    if (err) {
      return res.json({ error: err }).status(500);
    }
    return res.json({ data: data }).status(200);
  });
}

/**
 * Create a dataset with the provided options.
 */
function createDataset(req, res) {
  const datasetName = req.body.name;
  const datasetOptions = req.body.options;

  mbaasApi.sync.init(datasetName, datasetOptions, function(err, dataset) {
    if (err) {
      return res.json({ error: err }).status(500);
    }
    return res.json({ data: dataset }).status(200);
  });
}

/**
 * Update current server status with the options provided.
 * Used to set the server to a crashed state (returning 500's).
 */
function updateStatus(req, res) {
  if (req.body.status.hasOwnProperty('crashed')) {
    serverStatus.crashed = req.body.status.crashed;
  }

  if (req.body.status.hasOwnProperty('forcedResponse')) {
    serverStatus.forcedResponse = req.body.status.forcedResponse;
  }

  res.json({ data: serverStatus }).status(200);
}
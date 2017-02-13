const async = require('async');
const mbaasApi = require('fh-mbaas-api');
const express = require('express');
const mbaasExpress = mbaasApi.mbaasExpress();
const cors = require('cors');

const app = express();

// Enable CORS for all requests
app.use(cors());

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys([]));
app.use('/mbaas', mbaasExpress.mbaas);

// allow serving of static files from the public directory
app.use(express.static(__dirname + '/public'));

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());

app.post('/dataset/:datasetId/reset', resetDataset);

// Important that this is last!
app.use(mbaasExpress.errorHandler());

var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
var server = app.listen(port, host, function() {
  // eslint-disable-next-line
  console.log("App started at: " + new Date() + " on port: " + port);
});

/**
 * Request handler to delete all collections in MongoDB for a provided dataset.
 */
function resetDataset(req, res) {
  // Define titles for default, updates and collision collections in MongoDB.
  const dataset = req.params.datasetId;
  const updates = dataset + '-updates';
  const collisions = dataset + '-collision';

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

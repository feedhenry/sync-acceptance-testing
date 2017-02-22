[![Build Status](https://travis-ci.org/feedhenry/sync-acceptance-testing.svg?branch=master)](https://travis-ci.org/feedhenry/sync-acceptance-testing)

# Sync Acceptance Testing
End to end acceptance tests for the sync framework enabled.

Uses [phantomjs](http://phantomjs.org/) to run the [fh-js-sdk](https://github.com/feedhenry/fh-js-sdk), and [jasmine](https://github.com/gruntjs/grunt-contrib-jasmine) for the test runner.

## Prerequisites
Ensure mongod is running.

## Usage

```
npm install
npm test
```

## app.js
This file is [browserified](http://browserify.org/) into main.js which is then included
in `index.html` which is the Jasmine Spec Runner. The client runs on port 9002.

The server runs on port 8001, and is just a plain application.js file.

### Running individual test specs
By default all test are run but this can be filtered using the [--filter](https://github.com/gruntjs/grunt-contrib-jasmine#filtering-specs) option.  

For example, to only run the tests in a specific spec file:

    $ npm t -- --filter=syncCrudSpec.js


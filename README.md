# Sync Acceptance Testing

Uses phantomjs to run the fh-js-sdk, and jasmine for the test runner

The client runs on port 9002, and serves an index.html (which includes a browserfied main.js from app.js).
The server runs on port 8001, and is just a plain application.js file.


## Usage

Ensure mongod is running

```
npm i
npm test
```

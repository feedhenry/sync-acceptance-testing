# Sync Acceptance Testing

Uses phantomjs to run the fh-js-sdk.
$fh.sync client calls can be made by using `page.evaluate`.
$fh.sync server calls can be made by using the `fh` export from `application.js`

The client runs on port 9002, and serves an index.html (which includes a browserfied main.js from app.js).
The server runs on port 8001, and is just a plain application.js file, that exports the app & fh server api.

## Usage

```
npm i
npm test
```

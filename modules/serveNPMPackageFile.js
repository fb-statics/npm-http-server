import { stat as statFile } from 'fs'
import onHeaders from 'on-headers'
import parseNPMPackageURL from './parseNPMPackageURL'
import getExpirationDate from './getExpirationDate'
import getPackageFile from './getPackageFile'

function sendText(res, text) {
  res.type('text/plain').send(text)
}

function sendInvalidURLError(res, url) {
  sendText(res.status(403), 'Invalid URL: ' + url)
}

function sendNotFoundError(res, what) {
  sendText(res.status(404), 'Not found: ' + what)
}

function sendServerError(res, error) {
  sendText(res.status(500), 'Server error: ' + error.message)
}

function sendFile(res, file, expirationDate) {
  // Cache-Control overrides Expires
  onHeaders(res, function () {
    res.removeHeader('Cache-Control')
  })

  res.set('Expires', expirationDate.toGMTString()).sendFile(file)
}

const IndexFile = require('path').resolve(__dirname, '../index.html')

/**
 * Serves a file from an NPM package. Supported URL schemes are:
 *
 * /history@1.12.5/umd/History.min.js (recommended)
 * /history@latest/umd/History.min.js
 * /history/umd/History.min.js (latest is implied)
 */
function serveNPMPackageFile(req, res, next) {
  // TODO: Refactor this out.
  if (req.path === '/') {
    sendFile(res, IndexFile, new Date(Date.now() + 1000 * 60))
    return
  }

  const url = parseNPMPackageURL(req.path)

  if (url == null) {
    sendInvalidURLError(res, req.path)
    return next()
  }

  const { packageSpec, filename } = url

  getPackageFile(packageSpec, filename, function (error, file, version) {
    if (error) {
      sendServerError(res, error)
    } else if (file) {
      statFile(file, function (error) {
        if (error) {
          if (error.code === 'ENOENT') {
            sendNotFoundError(res, 'File "' + filename + '" in package ' + packageSpec)
          } else {
            sendServerError(res, error)
          }
        } else {
          sendFile(res, file, getExpirationDate(version))
        }
      })
    } else {
      sendNotFoundError(res, 'Package ' + packageSpec)
    }
  })
}

export default serveNPMPackageFile

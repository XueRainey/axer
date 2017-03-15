const fs = require('fs')
const request = require('request')
const FileCookieStore = require('tough-cookie-filestore')
const logger = require('log4js').getLogger()
const Promise = require('bluebird')

const handler = require('./handler')

const { followRedirect, promisify, parseForm, decodeURIForm, encodeURIForm } = handler

/**
 * Request Constructor
 * @param {string} cookiePath cookieJar file path. If undefined, the request won't take any cookie.
 * @param {object} config request config.
 */
function Request(cookiePath, config) {
  const defaultConfig = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    },
    gzip: true,
    timeout: 20000,
  }

  const appendConfig = config || {}

  if (cookiePath) {
    const jar = request.jar(new FileCookieStore(cookiePath))
    appendConfig.jar = jar
  }

  this.request = request.defaults(Object.assign(appendConfig, defaultConfig))
}

/**
 * Request server with GET method.
 * @param {string} url Request URL.
 * @param {object} params QueryString dictionary object. Axer will automaticlly encode all params value for request.
 * @return {Object} Axer will combine request object and response object and return to developer.
 */
Request.prototype.get = async function(url, params) {
  let _url = url
  if (typeof params === 'object') {
    const qs = encodeURIForm(params)
    _url = `${_url}?${qs}`
  }

  logger.info('GET', _url)
  const res = await promisify(this.request, _url)
  const response = await followRedirect(res, this.request)
  return response
}

/**
 * Request server with POST method.
 * @param {string} url Request URL.
 * @param {object} form post form. Axer will convert this object to x-www-form-urlencoded formart string.
 * @return {Object} Axer will combine request object and response object and return to developer.
 */
Request.prototype.post = async function(url, form) {
  if (typeof form === 'object') {
    form = decodeURIForm(form)
  }
 
  if (typeof form === 'string') {
    form = parseForm(form)
  }

  logger.info('POST ', url)
  logger.info('Body:', form)
  const res = await promisify(this.request.post, { url, form })
  const response = await followRedirect(res, this.request)
  return response
}

/**
 * Download file from server.
 * @param {string} url download url.
 * @param {string} filePath the file's save path.
 * @return {promise} return promise object for conveniently use aync/await.
 */
Request.prototype.download = function(url, filePath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(filePath)) {
      resolve(url)
      return
    }
    this.request.get(url)
      .on('response', res => {
        logger.info(`Status: ${res.statusCode}`)
        logger.info(`Content-Type: ${res.headers['content-type']}`)
        logger.info(`Content-Length: ${res.headers['content-length']}`)
      })
      .on('end', () => {
        logger.info(`Download success`)
        resolve(url)
      })
      .on('error', err => {
        logger.error(`Download failed: ${err}`)
        reject(err)
      })
      .pipe(fs.createWriteStream(filePath))
  })
}

module.exports = Request
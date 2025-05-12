const config = require('./api/config');
const collectionFetcher = require('./api/collectionFetcher');
const progressEmitter = require('./utils/progressEmitter');

module.exports = {
  getUserCollection: collectionFetcher.getUserCollection,
  setDiscogsToken: config.setDiscogsToken,
  onProgress: (callback) => progressEmitter.on('progress', callback),
  progressEmitter
};
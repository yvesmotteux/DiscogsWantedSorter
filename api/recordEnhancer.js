const requestManager = require('./requestManager');
const progressEmitter = require('../utils/progressEmitter');
const config = require('./config');
const logger = require('../utils/logger');

async function enhanceRecord(record, index, total) {
  // Try to fetch release details (independent)
  try {
    const releaseUrl = `https://api.discogs.com/releases/${record.id}?curr_abbr=${config.DEFAULT_CURRENCY}`;
    const releaseResponse = await requestManager.makeAPIRequest(releaseUrl, {}, { recordId: record.id });
    const releaseData = releaseResponse.data;

    record.haveCount = releaseData.community?.have || 0;
    record.wantCount = releaseData.community?.want || 0;
    record.numForSale = releaseData.num_for_sale || 0;

    if (releaseData.images && releaseData.images.length > 0) {
      const primaryImage = releaseData.images.find(img => img.type === 'primary') || releaseData.images[0];
      record.fullImageUrl = primaryImage.uri;

      if (primaryImage.uri150) {
        record.thumbnailUrl = primaryImage.uri150;
      }
    }

    record.year = releaseData.year || 'Unknown';
    record.format = releaseData.formats ?
      releaseData.formats.map(f => f.name).join(', ') :
      'Unknown';
  } catch (releaseError) {
    const statusCode = releaseError.response?.status || 'N/A';
    logger.log(`Failed to get release details for ${record.title} (ID: ${record.id}, Status: ${statusCode}): ${releaseError.message}`);
  }

  // Try to fetch price data (independent)
  try {
    const priceSuggestionUrl = `https://api.discogs.com/marketplace/price_suggestions/${record.id}`;
    const priceResponse = await requestManager.makeAPIRequest(priceSuggestionUrl, {}, { recordId: record.id });

    if (priceResponse.data && priceResponse.data[config.DEFAULT_CONDITION]) {
      record.medianPrice = priceResponse.data[config.DEFAULT_CONDITION].value.toFixed(2);
      record.currency = config.getCurrencySymbol(config.DEFAULT_CURRENCY);
    }
  } catch (priceError) {
    const statusCode = priceError.response?.status || 'N/A';
    logger.log(`Failed to get price data for ${record.title} (ID: ${record.id}, Status: ${statusCode}): ${priceError.message}`);
  }

  progressEmitter.emit('progress', {
    type: 'enhancement',
    message: 'Enhancing record details...',
    current: index + 1,
    total: total
  });

  progressEmitter.emit('recordEnhanced', {
    record,
    index: index,
    total: total
  });

  return record;
}

module.exports = {
  enhanceRecord
};
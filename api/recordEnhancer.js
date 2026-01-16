const requestManager = require('./requestManager');
const progressEmitter = require('../utils/progressEmitter');
const config = require('./config');

async function enhanceRecord(record, index, total) {
  try {
    const releaseUrl = `https://api.discogs.com/releases/${record.id}?curr_abbr=${config.DEFAULT_CURRENCY}`;
    const releaseResponse = await requestManager.makeAPIRequest(releaseUrl);
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

    try {
      const priceSuggestionUrl = `https://api.discogs.com/marketplace/price_suggestions/${record.id}`;
      const priceResponse = await requestManager.makeAPIRequest(priceSuggestionUrl);

      if (priceResponse.data && priceResponse.data[config.DEFAULT_CONDITION]) {
        record.medianPrice = priceResponse.data[config.DEFAULT_CONDITION].value.toFixed(2);
        record.currency = config.getCurrencySymbol(config.DEFAULT_CURRENCY);
      }
    } catch (priceError) {
      console.log(`Couldn't get price data for ${record.title}: ${priceError.message}`);
    }

    record.year = releaseData.year || 'Unknown';
    record.format = releaseData.formats ? 
      releaseData.formats.map(f => f.name).join(', ') : 
      'Unknown';
    
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
  } catch (detailError) {
    console.log(`Error getting details for ${record.title}: ${detailError.message}`);
    
    progressEmitter.emit('progress', {
      type: 'enhancement',
      message: 'Enhancing record details...',
      current: index + 1,
      total: total
    });
    
    return record;
  }
}

module.exports = {
  enhanceRecord
};
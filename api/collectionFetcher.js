const config = require('./config');
const requestManager = require('./requestManager');
const recordProcessor = require('./recordProcessor');
const recordEnhancer = require('./recordEnhancer');
const progressEmitter = require('../utils/progressEmitter');
const logger = require('../utils/logger');

async function getUserCollection(username) {
  if (!config.getDiscogsToken()) {
    throw new Error('Discogs API token is required. Please set your token in the application.');
  }
  
  try {
    progressEmitter.emit('progress', {
      type: 'collection',
      message: 'Fetching collection data...',
      current: 0,
      total: 0
    });
    
    logger.log(`Using Discogs API to fetch collection for ${username}`);
    
    const url = `https://api.discogs.com/users/${username}/collection/folders/0/releases`;
    const response = await requestManager.makeAPIRequest(url, {
      params: {
        per_page: 100,
        page: 1
      }
    });
    
    const data = response.data;
    const totalItems = data.pagination.items;
    const totalPages = data.pagination.pages;
    
    logger.log(`API reports ${totalItems} items in ${totalPages} pages`);
    
    if (totalItems === 0) {
      progressEmitter.emit('progress', {
        type: 'complete',
        message: 'No records found in collection',
        current: 0,
        total: 0
      });
      return [];
    }
    
    let allRecords = recordProcessor.processAPIRecords(data.releases);
    
    progressEmitter.emit('progress', {
      type: 'collection',
      message: 'Fetching collection data...',
      current: allRecords.length,
      total: totalItems
    });
    
    const pagePromises = [];
    
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(
        requestManager.makeAPIRequest(url, {
          params: {
            per_page: 100,
            page: page
          }
        }).then(pageResponse => {
          const pageRecords = recordProcessor.processAPIRecords(pageResponse.data.releases);
          allRecords = [...allRecords, ...pageRecords];
          
          progressEmitter.emit('progress', {
            type: 'collection',
            message: 'Fetching collection data...',
            current: Math.min(allRecords.length, totalItems),
            total: totalItems
          });
          
          if (page % 3 === 0 || page === totalPages) {
            logger.log(`Fetched page ${page}/${totalPages} with ${pageRecords.length} records via API`);
          }
        })
      );
    }
    
    await Promise.all(pagePromises);
    
    progressEmitter.emit('progress', {
      type: 'enhancement',
      message: 'Enhancing record details...',
      current: 0,
      total: allRecords.length
    });
    
    for (let i = 0; i < allRecords.length; i++) {
      const record = allRecords[i];
      allRecords[i] = await recordEnhancer.enhanceRecord(record, i, allRecords.length);
    }
    
    progressEmitter.emit('progress', {
      type: 'complete',
      message: 'Processing complete!',
      current: allRecords.length,
      total: allRecords.length
    });
    
    allRecords.sort((a, b) => {
      return b.wantCount - a.wantCount;
    });
    
    return allRecords;
  } catch (error) {
    logger.error('Error using Discogs API:', error.message);
    
    progressEmitter.emit('progress', {
      type: 'error',
      message: `Error: ${error.message}`,
      current: 0,
      total: 0
    });
    
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid Discogs API token. Please check your token and try again.');
    } else if (error.response && error.response.status === 404) {
      throw new Error('User not found or collection is not public.');
    }
    throw error;
  }
}

module.exports = {
  getUserCollection
};
const axios = require('axios');
const config = require('./config');
const logger = require('../utils/logger');

const requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = Date.now();

function isRetryableError(error) {
  // Connection errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
    return true;
  }

  // All 5XX HTTP status codes
  if (error.response && error.response.status) {
    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  return false;
}

function isRateLimitError(error) {
  return error.response && error.response.status === 429;
}

function getErrorContext(error) {
  if (error.response) {
    return {
      status: error.response.status,
      url: error.config?.url || 'unknown'
    };
  }
  if (error.code) {
    return {
      code: error.code,
      message: error.message
    };
  }
  return { message: error.message };
}

function formatRecordContext(request) {
  return request.context?.recordId ? `[Record ID: ${request.context.recordId}] ` : '';
}

async function makeAPIRequest(url, options = {}, context = {}) {

  return new Promise((resolve, reject) => {
    requestQueue.push({
      url,
      options,
      resolve,
      reject,
      retries: 0,
      context
    });
    
    if (!isProcessingQueue) {
      processRequestQueue();
    }
  });
}

async function processRequestQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  let requestsInCurrentMinute = 0;
  let minuteStartTime = Date.now();
  
  while (requestQueue.length > 0) {
    const now = Date.now();
    
    if (now - minuteStartTime >= 60000) {
      requestsInCurrentMinute = 0;
      minuteStartTime = now;
    }
    
    if (requestsInCurrentMinute >= config.MAX_SAFE_REQUESTS_PER_MINUTE) {
      const timeToNextMinute = 60000 - (now - minuteStartTime) + 50; // Small buffer
      logger.log(`Approaching rate limit (${requestsInCurrentMinute}/${config.MAX_SAFE_REQUESTS_PER_MINUTE}). Waiting ${timeToNextMinute}ms for next minute.`);
      await new Promise(resolve => setTimeout(resolve, timeToNextMinute));
      
      requestsInCurrentMinute = 0;
      minuteStartTime = Date.now();
      continue;
    }
    
    const request = requestQueue.shift();
    try {
      const requestOptions = {
        ...request.options,
        headers: {
          'User-Agent': 'DiscogsCollectionSorter/1.0',
          'Authorization': `Discogs token=${config.getDiscogsToken()}`,
          ...(request.options.headers || {})
        }
      };
      
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < 1000) {
        const waitTime = 1000 - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      lastRequestTime = Date.now();
      requestsInCurrentMinute++;
      
      const response = await axios.get(request.url, requestOptions);
      request.resolve(response);
    } catch (error) {
      const errorContext = getErrorContext(error);
      const recordContext = formatRecordContext(request);

      // Rate limiting - special case with longer wait
      if (isRateLimitError(error)) {
        logger.log(`${recordContext}Rate limit exceeded (429) for ${errorContext.url}. Pausing 10s.`);
        requestQueue.unshift(request);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      // Retryable errors (5XX, connection issues)
      else if (isRetryableError(error)) {
        if (request.retries < 3) {
          request.retries++;
          const waitTime = request.retries * 2000;

          if (errorContext.status) {
            logger.log(`${recordContext}HTTP ${errorContext.status} error. Retrying (${request.retries}/3) in ${waitTime}ms...`);
          } else {
            logger.log(`${recordContext}Network error (${errorContext.code}). Retrying (${request.retries}/3) in ${waitTime}ms...`);
          }

          requestQueue.unshift(request);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Max retries exceeded
          if (errorContext.status) {
            logger.error(`${recordContext}HTTP ${errorContext.status} error failed after 3 retries.`);
          } else {
            logger.error(`${recordContext}Network error (${errorContext.code}) failed after 3 retries.`);
          }
          request.reject(error);
        }
      }
      // Non-retryable errors (4XX except 429)
      else {
        if (errorContext.status) {
          logger.log(`${recordContext}Non-retryable HTTP ${errorContext.status} error. Not retrying.`);
        } else {
          logger.log(`${recordContext}Non-retryable error: ${errorContext.message}`);
        }
        request.reject(error);
      }
    }
  }
  
  isProcessingQueue = false;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  makeAPIRequest,
  delay
};
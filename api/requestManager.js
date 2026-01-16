const axios = require('axios');
const config = require('./config');

const requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = Date.now();

async function makeAPIRequest(url, options = {}) {
  
  return new Promise((resolve, reject) => {
    requestQueue.push({
      url,
      options,
      resolve,
      reject,
      retries: 0
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
      console.log(`Approaching rate limit (${requestsInCurrentMinute}/${config.MAX_SAFE_REQUESTS_PER_MINUTE}). Waiting ${timeToNextMinute}ms for next minute.`);
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
      if (error.response && error.response.status === 429) {
        console.log('Rate limit exceeded (429). Adding request back to queue and pausing.');
        requestQueue.unshift(request);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || 
                (error.response && (error.response.status === 500 || error.response.status === 503))) {
        if (request.retries < 3) {
          request.retries++;
          console.log(`Request failed with ${error.message}. Retrying (${request.retries}/3)...`);
          setTimeout(() => {
            requestQueue.unshift(request);
          }, request.retries * 2000); // Wait 2s, 4s, 6s between retries
        } else {
          console.log(`Request failed after 3 retries: ${error.message}`);
          request.reject(error);
        }
      } else {
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
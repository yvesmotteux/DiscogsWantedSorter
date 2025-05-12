const express = require('express');
const discogsClient = require('./discogsClient');
const config = require('./api/config');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 7341;

let localTokenCopy = process.env.DISCOGS_TOKEN || '';
if (localTokenCopy) {
  console.log('Discogs API token found and active.');
  discogsClient.setDiscogsToken(localTokenCopy);
} else {
  console.log('No Discogs API token found. A token is required to use this application.');
  console.log('You can set your Discogs API token in the DISCOGS_TOKEN environment variable or in the app UI.');
}

io.on('connection', (socket) => {
  console.log('Client connected for progress updates');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

discogsClient.onProgress((progressData) => {
  io.emit('progress', progressData);
  
  if (progressData.type === 'collection' || progressData.type === 'enhancement') {
    console.log(`Progress - ${progressData.message} ${progressData.current}/${progressData.total}`);
  }
});

discogsClient.progressEmitter.on('recordEnhanced', (recordData) => {
  io.emit('recordEnhanced', recordData);
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const tokenActive = config.getDiscogsToken() ? 'active' : 'inactive';
  res.render('index', { 
    results: null, 
    username: '',
    apiTokenStatus: tokenActive,
    tokenRequired: true
  });
});

app.post('/search', async (req, res) => {
  const username = req.body.username ? req.body.username.trim() : '';
  const apiToken = req.body.apiToken || '';
  
  if (!username) {
    return res.render('index', { 
      results: null, 
      username: '',
      error: 'Please enter a Discogs username',
      apiTokenStatus: config.getDiscogsToken() ? 'active' : 'inactive',
      tokenRequired: true
    });
  }
  
  if (apiToken && apiToken !== localTokenCopy) {
    localTokenCopy = apiToken;
    discogsClient.setDiscogsToken(apiToken);
    console.log('New Discogs API token set from the UI');
  }
  
  try {
    if (!config.getDiscogsToken()) {
      throw new Error('Discogs API token is required. Please set your token in the application.');
    }
    
    res.render('index', { 
      results: null, 
      username,
      apiTokenStatus: config.getDiscogsToken() ? 'active' : 'inactive',
      tokenRequired: true,
      loadingState: 'loading'
    });
    
    discogsClient.getUserCollection(username)
      .then((results) => {
        io.emit('results', { 
          success: true, 
          results,
          username
        });
      })
      .catch((error) => {
        console.error('Error:', error.message);
        io.emit('results', { 
          success: false, 
          error: `Error fetching collection: ${error.message}`,
          username
        });
      });
  } catch (error) {
    console.error('Error:', error.message);
    res.render('index', { 
      results: null, 
      username, 
      error: `Error fetching collection: ${error.message}`,
      apiTokenStatus: config.getDiscogsToken() ? 'active' : 'inactive',
      tokenRequired: true
    });
  }
});

app.post('/set-token', (req, res) => {
  const apiToken = req.body.apiToken || '';
  
  if (!apiToken) {
    localTokenCopy = '';
    discogsClient.setDiscogsToken('');
    console.log('Discogs API token cleared');
    return res.redirect('/');
  }
  
  localTokenCopy = apiToken;
  discogsClient.setDiscogsToken(apiToken);
  console.log('New Discogs API token set');
  
  res.redirect('/');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
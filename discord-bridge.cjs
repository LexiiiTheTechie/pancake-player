const RPC = require('discord-rpc');
const http = require('http');

const clientID = '1441191089389436970';
const client = new RPC.Client({ transport: 'ipc' });

let isConnected = false;

// Handle RPC connection
async function connect() {
  try {
    await client.login({ clientId: clientID });
    console.log('✅ Bridge: Connected to Discord');
    isConnected = true;
  } catch (err) {
    console.error('❌ Bridge: Discord connect failed, retrying in 10s...', err.message);
    setTimeout(connect, 10000);
  }
}

client.on('ready', () => {
  console.log('✅ Bridge: Presence Ready');
});

// Simple HTTP server to receive updates from local React app
const server = http.createServer((req, res) => {
  // Allow requests from our Tauri app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (isConnected) {
          const activity = {
            details: data.title || 'Idle',
            state: data.isPlaying 
              ? (data.artist ? `by ${data.artist}` : undefined)
              : 'Paused',
            largeImageKey: 'pancake-player-logo2',
            largeImageText: 'Pancake Player',
            instance: false,
          };

          if (data.isPlaying) {
            activity.startTimestamp = data.startTime || Math.floor(Date.now() / 1000);
          }

          await client.setActivity(activity);
          console.log(`✅ Bridge: ${data.isPlaying ? 'Playing' : 'Paused'} -> ${data.title}`);
        }
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(500);
        res.end(e.message);
      }
    });
  }
});

// Start bridge on a random high port
const PORT = 33333;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`📡 Presence Bridge listening on http://127.0.0.1:${PORT}`);
  connect();
});

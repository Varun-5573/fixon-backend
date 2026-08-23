const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const URL_FILE = path.join(__dirname, 'public_tunnel_url.json');

function startTunnel() {
  console.log('🚀 Starting Cloudflare Tunnel for http://localhost:5000...');

  const child = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', 'http://localhost:5000'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let tunnelUrl = null;

  const parseLine = (line) => {
    const str = line.trim();
    if (!str) return;
    const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      const newUrl = match[0];
      if (newUrl !== tunnelUrl) {
        tunnelUrl = newUrl;
        console.log('\n==================================================');
        console.log('✨ PUBLIC CLOUDFLARE HTTPS API TUNNEL IS ONLINE:');
        console.log('👉', tunnelUrl);
        console.log('==================================================\n');
        fs.writeFileSync(URL_FILE, JSON.stringify({ url: tunnelUrl, updatedAt: new Date().toISOString() }, null, 2));
      }
    }
  };

  child.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(parseLine);
  });

  child.stderr.on('data', (data) => {
    data.toString().split('\n').forEach(parseLine);
  });

  child.on('close', (code) => {
    console.warn(`Cloudflare tunnel exited with code ${code}, restarting in 3 seconds...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();

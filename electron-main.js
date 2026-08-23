const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');

let mainWindow;
let serverProcess = null;

function startBackendServer() {
  // Check if server is already running on port 5000
  const req = http.get('http://localhost:5000/api/health', (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Local server is already running on port 5000');
    }
  });
  req.on('error', () => {
    console.log('🚀 Spawning background Node server (server.js)...');
    try {
      serverProcess = fork(path.join(__dirname, 'server.js'), [], {
        cwd: __dirname,
        silent: false
      });
      serverProcess.on('error', (err) => console.error('Server process error:', err));
    } catch (e) {
      console.error('Failed to spawn server.js:', e);
    }
  });
}

function createWindow() {
  startBackendServer();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    title: 'FixoN Admin Control Panel',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  // Check if live dev server is active on localhost:3000, otherwise load build/index.html
  const devUrl = 'http://localhost:3000';
  http.get(devUrl, (res) => {
    if (res.statusCode === 200 && mainWindow) {
      mainWindow.loadURL(devUrl);
    } else if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    }
  }).on('error', () => {
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    }
  });

  // Create a minimal menu
  const template = [
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'App',
      submenu: [
        { label: 'Version 1.0.0', enabled: false },
        { role: 'quit' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

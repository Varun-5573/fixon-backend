const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

function createWindow() {
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

  // Open DevTools in development if needed (uncomment for debug)
  // mainWindow.webContents.openDevTools();

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

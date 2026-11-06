// electron-main.js - FixoN Admin Panel
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'FixoN Admin Control Panel',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,   // Allow loading external map tiles + API calls
    },
  });

  // Allow ALL requests (map tiles, API, socket.io, CDN assets)
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, Origin: '*' } });
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'access-control-allow-origin': ['*'],
        'content-security-policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "img-src * data: blob:; " +
          "connect-src * ws: wss: http: https:; " +
          "font-src * data:;"
        ],
      },
    });
  });

  // Load the built React admin panel
  const indexPath = path.join(__dirname, 'build', 'index.html');
  win.loadFile(indexPath);

  // Uncomment to open DevTools for debugging:
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Allow all permissions (location, notifications, etc.)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

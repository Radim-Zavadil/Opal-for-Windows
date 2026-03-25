const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const config = require('./services/config');
const blocker = require('./services/blocker');
const server = require('./services/server');

let mainWindow;
let interruptWindow;

let sessionTimer = null;
let sessionState = {
  active: false,
  remainingTime: 0,
  name: '',
  blockedCount: 0
};

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
    },
    backgroundColor: '#121212',
    show: false
  });

  mainWindow.loadFile('renderer/index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function createInterruptWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  interruptWindow = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  interruptWindow.loadFile('assets/interrupt.html');
  
  // Prevent closing with alt-f4 during a real block... but we leave standard controls mostly as requested.
  interruptWindow.on('close', (e) => {
    if (sessionState.active) {
      e.preventDefault();
      interruptWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createInterruptWindow();
  server.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  server.stop();
  blocker.stop();
});

// -- IPC Handlers --

ipcMain.handle('get-config', () => {
  return config.data;
});

ipcMain.handle('save-config', (event, newConfig) => {
  config.data = newConfig;
  config.save();
  return true;
});

ipcMain.handle('get-session-state', () => {
  return sessionState;
});

ipcMain.handle('start-session', (event, { name, duration, sites, apps }) => {
  if (sessionState.active) return false;

  sessionState.active = true;
  sessionState.name = name;
  sessionState.remainingTime = duration;
  sessionState.blockedCount = sites.length + apps.length;

  blocker.start(sites, apps, () => {
    // Called when a blocked app is detected
    if (interruptWindow) {
      interruptWindow.webContents.send('set-blocked-app', Array.isArray(apps) ? apps[0] : 'App');
      interruptWindow.show();
      interruptWindow.setAlwaysOnTop(true, 'screen-saver');
      interruptWindow.focus();
    }
  });

  sessionTimer = setInterval(() => {
    sessionState.remainingTime--;
    if (sessionState.remainingTime <= 0) {
      stopSession();
    }
    if (mainWindow) {
      mainWindow.webContents.send('session-tick', sessionState);
    }
  }, 1000);

  return true;
});

ipcMain.handle('stop-session', () => {
  stopSession();
  return true;
});

ipcMain.on('close-interrupt', () => {
  if (interruptWindow) {
    interruptWindow.hide();
  }
});

function stopSession() {
  if (sessionTimer) clearInterval(sessionTimer);
  sessionState.active = false;
  sessionState.remainingTime = 0;
  blocker.stop();
  
  if (interruptWindow) {
    interruptWindow.hide();
  }
  
  if (mainWindow) {
    mainWindow.webContents.send('session-ended');
  }
}

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const config = require('./services/config');
const blocker = require('./services/blocker');

let mainWindow;
let interruptWindow;

let sessionTimer = null;
let sessionState = {
  active: false,
  status: 'none',
  remainingTime: 0,
  totalDuration: 0,
  name: '',
  blockedCount: 0,
  iconData: null,
  pIcon: 'star',
  sites: [],
  apps: []
};

let pauseBlockerUntil = 0;

function createMainWindow() {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    /* titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
    }, */
    backgroundColor: '#121212',
    show: false
  });

  const indexPath = path.join(__dirname, 'renderer', 'index.html');
  console.log('Loading file:', indexPath);
  
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('Failed to load index.html:', err);
  });

  mainWindow.once('ready-to-show', () => {
    console.log('Main window ready to show.');
    mainWindow.show();
    // mainWindow.webContents.openDevTools(); // Uncomment to debug renderer
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Main window failed to load:', errorCode, errorDescription);
  });
}

function createInterruptWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  interruptWindow = new BrowserWindow({
    width,
    height,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    title: 'Focus Interrupted',
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
  // server.stop(); // Removed server logic
  blocker.stop();
});

app.on('before-quit', () => {
  // server.stop(); // Removed server logic
  blocker.stop();
});

app.on('quit', () => {
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

ipcMain.handle('start-session', (event, { name, duration, sites, apps, iconData, pIcon }) => {
  if (sessionState.active) return false;

  sessionState.active = true;
  sessionState.status = 'active';
  sessionState.name = name;
  sessionState.remainingTime = duration;
  sessionState.totalDuration = duration;
  sessionState.blockedCount = sites.length + apps.length;
  sessionState.iconData = iconData || null;
  sessionState.pIcon = pIcon || 'star';
  sessionState.sites = sites || [];
  sessionState.apps = apps || [];

  blocker.start(sites, apps, (detectedName, pids) => {
    if (Date.now() < pauseBlockerUntil) return;
    
    if (interruptWindow && !blocker.isShowingOverlay(detectedName)) {
      blocker.setOverlayShown(detectedName, true);
      interruptWindow.webContents.send('set-blocked-app', detectedName, pids);
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

ipcMain.handle('resume-session', () => {
  if (sessionState.status === 'stopped') {
    sessionState.active = true;
    sessionState.status = 'active';

    blocker.start(sessionState.sites, sessionState.apps, (detectedName, pids) => {
      if (Date.now() < pauseBlockerUntil) return;
      if (interruptWindow && !blocker.isShowingOverlay(detectedName)) {
        blocker.setOverlayShown(detectedName, true);
        interruptWindow.webContents.send('set-blocked-app', detectedName, pids);
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
    
    // Send immediate tick so UI updates instantly
    if (mainWindow) {
      mainWindow.webContents.send('session-tick', sessionState);
    }
  }
  return true;
});

ipcMain.on('dismiss-overlay', (event, appName, pids) => {
  if (interruptWindow) {
    interruptWindow.hide();
  }
  if (appName) {
    blocker.dismissApp(appName, pids);
  }
});

ipcMain.on('close-app', (event, appName) => {
  if (interruptWindow) {
    interruptWindow.hide();
  }
  
  if (appName) {
    blocker.setOverlayShown(appName, false);
    const searchName = appName.toLowerCase().endsWith('.exe') ? appName : (appName + '.exe');
    exec(`taskkill /F /IM ${searchName}`, (err) => {
      if (err) console.error('Failed to kill app', err);
    });
  }
});

ipcMain.handle('is-extension-installed', () => {
  return blocker.isExtensionInstalled();
});

ipcMain.handle('install-extension', async () => {
  return await blocker.installExtension();
});

ipcMain.handle('uninstall-extension', async () => {
  return await blocker.uninstallExtension();
});

function stopSession() {
  if (sessionTimer) clearInterval(sessionTimer);
  sessionState.active = false;
  sessionState.status = 'stopped';
  blocker.stop();
  
  if (interruptWindow) {
    interruptWindow.hide();
  }
  
  if (mainWindow) {
    mainWindow.webContents.send('session-ended');
  }
}

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getSessionState: () => ipcRenderer.invoke('get-session-state'),
  startSession: (params) => ipcRenderer.invoke('start-session', params),
  stopSession: () => ipcRenderer.invoke('stop-session'),
  resumeSession: () => ipcRenderer.invoke('resume-session'),
  
  onSessionTick: (callback) => ipcRenderer.on('session-tick', (_event, state) => callback(state)),
  onSessionEnded: (callback) => ipcRenderer.on('session-ended', () => callback())
});

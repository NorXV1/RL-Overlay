'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  authSuccess : (data) => ipcRenderer.send('auth-success', data),
  logout      : ()     => ipcRenderer.send('auth-logout'),
});

'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rlSetup', {
  browse : ()     => ipcRenderer.invoke('setup:browse'),
  skip   : ()     => ipcRenderer.send('setup:skip'),
});

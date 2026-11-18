'use strict';
const { contextBridge, ipcRenderer } = require('electron');

/* langue de l'interface : dictionnaire de la langue choisie (ou de Windows) */
try { contextBridge.exposeInMainWorld('__i18nData', ipcRenderer.sendSync('i18n:get-sync')); } catch {}

contextBridge.exposeInMainWorld('rlSetup', {
  browse : ()     => ipcRenderer.invoke('setup:browse'),
  skip   : ()     => ipcRenderer.send('setup:skip'),
});

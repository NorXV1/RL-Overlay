'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  authSuccess : (data) => ipcRenderer.send('auth-success', data),
  logout      : ()     => ipcRenderer.send('auth-logout'),
  openUrl     : (url)  => ipcRenderer.send('open-url', url),
  openStudio  : ()     => ipcRenderer.send('open-studio'),
  studioSave  : (opts) => ipcRenderer.invoke('studio:save', opts),
  studioOpen  : (opts) => ipcRenderer.invoke('studio:open', opts),
  /* HUD à l'écran (caster) : afficher / masquer, écran, opacité, masqué des captures */
  hudGet      : ()     => ipcRenderer.invoke('hud:get'),
  hudSet      : (opts) => ipcRenderer.invoke('hud:set', opts),
  onHudState  : (cb)   => ipcRenderer.on('hud:state', (e, s) => cb(s)),
});

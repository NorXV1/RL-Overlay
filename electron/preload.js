'use strict';
const { contextBridge, ipcRenderer } = require('electron');

/* langue de l'interface : les fenêtres locales (connexion, CGU) reçoivent le dictionnaire au chargement
   (les pages du serveur local le chargent elles-mêmes avec /i18n/boot.js) */
if (location.protocol === 'file:') {
  try { contextBridge.exposeInMainWorld('__i18nData', ipcRenderer.sendSync('i18n:get-sync')); } catch {}
}

contextBridge.exposeInMainWorld('electronAPI', {
  authSuccess : (data) => ipcRenderer.send('auth-success', data),
  logout      : ()     => ipcRenderer.send('auth-logout'),
  openUrl     : (url)  => ipcRenderer.send('open-url', url),
  /* acceptation des CGU (fenêtre affichée une seule fois par compte) */
  cguAccept   : ()     => ipcRenderer.invoke('cgu:accept'),
  cguRefuse   : ()     => ipcRenderer.send('cgu:refuse'),
  openStudio  : ()     => ipcRenderer.send('open-studio'),
  studioSave  : (opts) => ipcRenderer.invoke('studio:save', opts),
  studioOpen  : (opts) => ipcRenderer.invoke('studio:open', opts),
  /* projet .rlstudio ouvert par double-clic alors que le Studio est déjà ouvert */
  onStudioOpenFile: (cb) => ipcRenderer.on('studio:open-file', (e, file) => cb(file)),
  /* HUD à l'écran (caster) : afficher / masquer, écran, opacité, masqué des captures */
  hudGet      : ()     => ipcRenderer.invoke('hud:get'),
  hudSet      : (opts) => ipcRenderer.invoke('hud:set', opts),
  onHudState  : (cb)   => ipcRenderer.on('hud:state', (e, s) => cb(s)),
  /* langue de l'interface (FR / EN) */
  i18nGet     : (lang) => ipcRenderer.invoke('i18n:get', lang),
  i18nSet     : (lang) => ipcRenderer.invoke('i18n:set', lang),
  onI18nChange: (cb)   => ipcRenderer.on('i18n:changed', (e, lang) => cb(lang)),
});

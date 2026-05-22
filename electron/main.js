'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');

let mainWindow = null;
let tray       = null;

// ── Instance unique ────────────────────────────────────────
// Si une 2ème instance tente de démarrer : focus la 1ère et stoppe net.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0); // exit immédiat, pas de suite
} else {

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ── Démarrer le serveur Express/WebSocket ────────────────
  try {
    const srv = require('../server');
    srv.onRestartRequest(() => { app.relaunch(); app.exit(0); });
  } catch (e) {
    dialog.showErrorBox('Erreur serveur', `Impossible de démarrer :\n${e.message}`);
    app.exit(1);
  }

  // ── Fenêtre principale ───────────────────────────────────
  function createWindow() {
    mainWindow = new BrowserWindow({
      width:  1160,
      height: 840,
      minWidth:  860,
      minHeight: 600,
      title: 'RL Overlay — Contrôles',
      autoHideMenuBar: true,
      backgroundColor: '#09090f',
      icon: path.join(__dirname, '../public/logos/logo.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    function tryLoad(retries = 20) {
      mainWindow.loadURL('http://localhost:3000/controls.html').catch(() => {
        if (retries > 0) setTimeout(() => tryLoad(retries - 1), 250);
      });
    }
    tryLoad();

    mainWindow.on('close', e => {
      if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
    });
  }

  // ── Tray ─────────────────────────────────────────────────
  function createTray() {
    const img  = nativeImage.createFromPath(path.join(__dirname, '../public/logos/logo.png'));
    const icon = img.resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('RL Overlay');

    const menu = Menu.buildFromTemplate([
      { label: 'Afficher le panneau',     click: () => { mainWindow.show(); mainWindow.focus(); } },
      { label: 'Ouvrir dans le navigateur', click: () => shell.openExternal('http://localhost:3000/controls.html') },
      { type: 'separator' },
      { label: 'Quitter',                 click: () => { app.isQuitting = true; app.quit(); } },
    ]);

    tray.setContextMenu(menu);
    tray.on('click',        () => { mainWindow.show(); mainWindow.focus(); });
    tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
  }

  // ── Cycle de vie ─────────────────────────────────────────
  app.whenReady().then(() => { createWindow(); createTray(); });
  app.on('window-all-closed', e => e.preventDefault());
  app.on('activate', () => { if (mainWindow) mainWindow.show(); });

}

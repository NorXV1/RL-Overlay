'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, ipcMain } = require('electron');
const path  = require('path');
const fs    = require('fs');
const https = require('https');

let mainWindow  = null;
let loginWindow = null;
let tray        = null;
let srv         = null;  // référence au module server

/* ── Session ───────────────────────────────────────────────── */
const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

function readSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch { return null; }
}
function saveSession(data) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
}
function clearSession() {
  try { fs.unlinkSync(SESSION_FILE); } catch {}
}

/* ── Valider la clé contre overlay.rscast.fr ────────────────── */
function validateKey(key) {
  return new Promise(resolve => {
    https.get(`https://overlay.rscast.fr/api/validate?key=${encodeURIComponent(key)}`, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ valid: false }); }
      });
    }).on('error', () => resolve({ valid: false }));
  });
}

/* ── Discord Rich Presence ──────────────────────────────────── */
const DISCORD_CLIENT_ID = '1507792608079118607';
let rpc = null;

function initDiscordRPC() {
  try {
    const DiscordRPC = require('discord-rpc');
    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });
    const startTimestamp = new Date();
    rpc.on('ready', () => {
      rpc.setActivity({
        details: 'Overlay actif', startTimestamp,
        largeImageKey: 'logo', largeImageText: 'RL Overlay', instance: false,
      }).catch(() => {});
    });
    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(() => {});
  } catch {}
}
function destroyDiscordRPC() {
  if (rpc) { try { rpc.destroy(); } catch {} rpc = null; }
}

/* ── Instance unique ─────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.exit(0); } else {

  app.on('second-instance', () => {
    const win = mainWindow || loginWindow;
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });

  /* ── Serveur Express/WebSocket ─────────────────────────────── */
  try {
    srv = require('../server');
    srv.onRestartRequest(() => { app.relaunch(); app.exit(0); });
  } catch (e) {
    dialog.showErrorBox('Erreur serveur', `Impossible de démarrer :\n${e.message}`);
    app.exit(1);
  }

  /* ── Fenêtre de login ──────────────────────────────────────── */
  function createLoginWindow() {
    if (loginWindow) { loginWindow.focus(); return; }
    loginWindow = new BrowserWindow({
      width : 380,
      height: 490,
      resizable   : false,
      maximizable : false,
      title       : 'RL Overlay — Connexion',
      autoHideMenuBar: true,
      backgroundColor: '#04060c',
      icon: path.join(__dirname, '../public/logos/logo.png'),
      webPreferences: {
        nodeIntegration : false,
        contextIsolation: true,
        preload         : path.join(__dirname, 'preload.js'),
      },
    });
    loginWindow.loadFile(path.join(__dirname, 'login.html'));
    loginWindow.on('closed', () => { loginWindow = null; });
  }

  /* ── Fenêtre principale ────────────────────────────────────── */
  function createMainWindow(session) {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); return; }

    // Passer la session au serveur local
    if (srv && srv.setSession) srv.setSession(session);

    mainWindow = new BrowserWindow({
      width : 1160, height: 840,
      minWidth: 860, minHeight: 600,
      title: 'RL Overlay — Contrôles',
      autoHideMenuBar: true,
      backgroundColor: '#09090f',
      icon: path.join(__dirname, '../public/logos/logo.png'),
      webPreferences: {
        nodeIntegration : false,
        contextIsolation: true,
        preload         : path.join(__dirname, 'preload.js'),
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
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  /* ── IPC : login réussi depuis la fenêtre de login ─────────── */
  ipcMain.on('auth-success', (e, data) => {
    saveSession(data);
    if (loginWindow) { loginWindow.destroy(); loginWindow = null; }
    createMainWindow(data);
    createTray();
    initDiscordRPC();
  });

  /* ── IPC : déconnexion depuis controls.html ─────────────────── */
  ipcMain.on('auth-logout', () => {
    clearSession();
    if (srv && srv.setSession) srv.setSession(null);
    if (mainWindow) { mainWindow.destroy(); mainWindow = null; }
    destroyDiscordRPC();
    createLoginWindow();
  });

  /* ── Tray ───────────────────────────────────────────────────── */
  function createTray() {
    if (tray) return;
    const img  = nativeImage.createFromPath(path.join(__dirname, '../public/logos/logo.png'));
    const icon = img.resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('RL Overlay');
    const menu = Menu.buildFromTemplate([
      { label: 'Afficher le panneau',        click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: 'Ouvrir dans le navigateur',  click: () => shell.openExternal('http://localhost:3000/controls.html') },
      { type: 'separator' },
      { label: 'Quitter', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('click',        () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
    tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  }

  /* ── Démarrage ──────────────────────────────────────────────── */
  app.whenReady().then(async () => {
    const session = readSession();

    if (session && session.license) {
      // Valider la clé en ligne
      const result = await validateKey(session.license);
      if (result.valid) {
        // Mettre à jour le tier depuis le serveur
        const updatedSession = { ...session, tier: result.tier || session.tier || 'basic' };
        saveSession(updatedSession);
        createMainWindow(updatedSession);
        createTray();
        initDiscordRPC();
        return;
      }
    }

    // Pas de session valide → fenêtre de login
    createLoginWindow();
  });

  app.on('window-all-closed', e => e.preventDefault());
  app.on('activate', () => {
    const win = mainWindow || loginWindow;
    if (win) win.show();
  });
  app.on('before-quit', () => { destroyDiscordRPC(); });
}

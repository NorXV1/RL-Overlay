'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, ipcMain } = require('electron');
const path  = require('path');
const fs    = require('fs');
const https = require('https');
const os    = require('os');

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

  /* ── IPC : ouvrir URL dans le navigateur externe ─────────────── */
  ipcMain.on('open-url', (e, url) => {
    if (typeof url === 'string' && url.startsWith('https://overlay.rscast.fr')) {
      shell.openExternal(url);
    }
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

  /* ── Vérification PacketSendRate StatsAPI ───────────────────── */

  /* Fichier de config Electron (séparé de settings.json géré par server.js) */
  const APP_CONFIG_PATH = path.join(app.getPath('userData'), 'rl-config.json');
  function readAppSettings()  { try { return JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf8')); } catch { return {}; } }
  function saveAppSettings(s) { fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(s, null, 2)); }

  /* ── Fenêtre de configuration RL ──────────────────────────── */
  let _setupResolve = null;
  let setupWindow   = null;

  function closeSetupWindow() {
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.destroy();
      setupWindow = null;
    }
  }

  /* IPC — appelé par le bouton "Choisir" dans setup.html */
  ipcMain.handle('setup:browse', async () => {
    const { filePaths } = await dialog.showOpenDialog(setupWindow, {
      title      : 'Dossier d\'installation de Rocket League',
      properties : ['openDirectory'],
    });
    if (!filePaths?.length) return null; // annulé → null envoyé à setup.html

    const chosen  = filePaths[0];
    const exePath = path.join(chosen, 'Binaries', 'Win64', 'RocketLeague.exe');
    const iniPath = path.join(chosen, 'TAGame', 'Config', 'DefaultStatsAPI.ini');

    // Vérifier que RocketLeague.exe est un vrai fichier (pas un raccourci .lnk)
    try {
      const stat = fs.statSync(exePath);
      if (!stat.isFile()) throw new Error('not a file');
    } catch {
      return {
        error: `RocketLeague.exe introuvable dans :\n${chosen}\\Binaries\\Win64\\\n\nVérifie que tu as bien sélectionné le dossier RACINE de Rocket League (pas un raccourci, pas un sous-dossier).`,
      };
    }

    if (!fs.existsSync(iniPath)) {
      return {
        error: `DefaultStatsAPI.ini introuvable dans :\n${chosen}\\TAGame\\Config\\\n\nLe dossier semble invalide.`,
      };
    }

    // ✅ Dossier valide → sauvegarder, répondre au renderer puis fermer
    const s = readAppSettings();
    s.rlInstallPath = chosen;
    saveAppSettings(s);

    // On laisse 120 ms pour que la réponse IPC parte avant de détruire la fenêtre
    setTimeout(() => {
      closeSetupWindow();
      if (_setupResolve) { _setupResolve(chosen); _setupResolve = null; }
    }, 120);
    return { ok: true };
  });

  /* IPC — bouton "Passer" */
  ipcMain.on('setup:skip', () => {
    closeSetupWindow();
    if (_setupResolve) { _setupResolve(''); _setupResolve = null; }
  });

  /* Affiche la fenêtre de config si le chemin n'est pas encore valide */
  function ensureRLPath() {
    const exeRelative = path.join('Binaries', 'Win64', 'RocketLeague.exe');
    const iniRelative = path.join('TAGame', 'Config', 'DefaultStatsAPI.ini');
    const s     = readAppSettings();
    const saved = s.rlInstallPath || '';
    if (
      saved &&
      fs.existsSync(path.join(saved, exeRelative)) &&
      fs.existsSync(path.join(saved, iniRelative))
    ) return Promise.resolve(saved);

    return new Promise(resolve => {
      _setupResolve = resolve;
      setupWindow = new BrowserWindow({
        width : 540, height: 580,
        resizable   : false,
        maximizable : false,
        title       : 'RL Overlay — Configuration',
        autoHideMenuBar: true,
        backgroundColor: '#04060c',
        icon: path.join(__dirname, '../public/logos/logo.png'),
        webPreferences: {
          nodeIntegration : false,
          contextIsolation: true,
          preload         : path.join(__dirname, 'setup-preload.js'),
        },
      });
      setupWindow.loadFile(path.join(__dirname, 'setup.html'));
      // Croix fermée par l'utilisateur = passer
      setupWindow.on('closed', () => {
        setupWindow = null;
        if (_setupResolve) { _setupResolve(''); _setupResolve = null; }
      });
    });
  }

  function getRLIniPaths(rlPath) {
    const list = [];
    // Config utilisateur — toujours au même endroit
    list.push(path.join(os.homedir(), 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Config', 'TAStatsAPI.ini'));
    // Config jeu — dossier sauvegardé
    if (rlPath) {
      const p = path.join(rlPath, 'TAGame', 'Config', 'DefaultStatsAPI.ini');
      if (fs.existsSync(p)) list.push(p);
    }
    return list;
  }

  function checkAndFixStatsApi(rlPath) {
    let fixed = false;
    for (const iniPath of getRLIniPaths(rlPath)) {
      try {
        if (!fs.existsSync(iniPath)) continue;
        let txt = fs.readFileSync(iniPath, 'utf8');
        if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // BOM
        const m = txt.match(/PacketSendRate\s*=\s*(\d+)/i);
        if (m && m[1] !== '100') {
          fs.writeFileSync(iniPath, txt.replace(/PacketSendRate\s*=\s*\d+/i, 'PacketSendRate=100'), 'utf8');
          console.log('[Config] PacketSendRate corrigé :', iniPath);
          fixed = true;
        }
      } catch (e) { console.log('[Config] Erreur :', iniPath, e.message); }
    }
    return fixed;
  }

  /* ── Démarrage ──────────────────────────────────────────────── */
  app.whenReady().then(async () => {
    // Demande le dossier RL si pas encore configuré, puis vérifie PacketSendRate
    const rlPath = await ensureRLPath();
    if (checkAndFixStatsApi(rlPath)) {
      await dialog.showMessageBox({
        type   : 'warning',
        title  : 'Configuration Rocket League corrigée',
        message: 'Le PacketSendRate a été remis à 100 dans les fichiers de config de Rocket League.\n\nRelance Rocket League pour appliquer les changements.',
        buttons: ['OK'],
      });
    }

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

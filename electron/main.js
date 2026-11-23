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

/* ── Traduction des boîtes de dialogue et menus (public/i18n/fr.json, en.json) ── */
const I18N_DIR = path.join(__dirname, '..', 'public', 'i18n');
const _dicts = {};
function curLang() { try { return srv && srv.getLang ? srv.getLang() : 'fr'; } catch { return 'fr'; } }
function dictFor(lang) {
  if (!_dicts[lang]) { try { _dicts[lang] = JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8')); } catch { _dicts[lang] = {}; } }
  return _dicts[lang];
}
function T(key, ...vars) {
  const d = dictFor(curLang());
  const s = (typeof d[key] === 'string' && d[key]) || key;
  return s.replace(/\{(\d+)\}/g, (_, n) => vars[n] ?? '');
}

/* ── Protocole rloverlay:// (lien "Installer sur l'application" du site) ── */
let pendingProtocolShareId = null;

function parseProtocolUrl(url) {
  const m = /^rloverlay:\/\/install-theme\/([A-Za-z0-9]+)/i.exec(url || '');
  return m ? m[1].toUpperCase() : null;
}

/* Déclenche le téléchargement dans le serveur local déjà en cours d'exécution
   (même processus, requête HTTP interne vers 127.0.0.1) */
function triggerThemeDownload(shareId) {
  const http = require('http');
  const data = Buffer.from(JSON.stringify({ shareId }));
  const req = http.request({
    hostname: '127.0.0.1', port: 3000, path: '/api/themes/download-by-id', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
  });
  req.on('error', () => {});
  req.write(data);
  req.end();
}

/* Extrait un éventuel lien rloverlay:// des arguments de lancement et, si l'app
   est déjà prête (fenêtre principale ouverte), lance le téléchargement tout de
   suite ; sinon on le garde en attente jusqu'à ce que l'utilisateur soit connecté. */
/* ── Fichier de projet du Studio (.rlstudio) ouvert avec l'app (double-clic, « Ouvrir avec ») ──
   Windows passe le chemin du fichier dans la ligne de commande : au lancement (process.argv) ou, si l'app
   tourne déjà, à l'instance déjà ouverte (second-instance). Le Studio s'ouvre avec le projet une fois le
   panneau prêt (connexion et CGU faites). */
let pendingStudioFile = null;
function findStudioFile(argv) {
  return (argv || []).find(a => typeof a === 'string' && /\.rlstudio$/i.test(a) && fs.existsSync(a)) || null;
}
/* Association .rlstudio → RL Overlay pour l'utilisateur Windows (HKCU, sans droits admin). L'installeur la
   crée aussi, mais une mise à jour depuis l'app ne relance pas l'installeur : on l'enregistre ici, une
   fois par emplacement de l'exécutable (app installée seulement, jamais en développement). */
function registerStudioFileAssociation() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const exe = process.execPath, flag = path.join(app.getPath('userData'), 'rlstudio-assoc.json');
  try { if (JSON.parse(fs.readFileSync(flag, 'utf8')).exe === exe) return; } catch {}
  const { execFile } = require('child_process');
  const progId = 'RLOverlay.rlstudio', root = 'HKCU\\Software\\Classes';
  const keys = [
    [`${root}\\.rlstudio`, progId],
    [`${root}\\${progId}`, 'Projet du Studio RL Overlay'],
    [`${root}\\${progId}\\DefaultIcon`, `"${exe}",0`],
    [`${root}\\${progId}\\shell\\open\\command`, `"${exe}" "%1"`],
  ];
  let i = 0;
  const next = () => {
    if (i >= keys.length) { try { fs.writeFileSync(flag, JSON.stringify({ exe, at: new Date().toISOString() })); } catch {} return; }
    const [key, val] = keys[i++];
    execFile('reg.exe', ['add', key, '/ve', '/d', val, '/f'], { windowsHide: true }, err => { if (err) console.warn('[Association .rlstudio]', err.message); else next(); });
  };
  next();
}

function handleProtocolArgv(argv) {
  const url = (argv || []).find(a => a.startsWith('rloverlay://'));
  const shareId = parseProtocolUrl(url);
  if (!shareId) return;
  if (mainWindow) {
    mainWindow.show(); mainWindow.focus();
    triggerThemeDownload(shareId);
  } else {
    pendingProtocolShareId = shareId;
  }
}

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
        details: T('Overlay actif'), startTimestamp,
        largeImageKey: 'logo', largeImageText: 'RL Overlay', instance: false,
      }).catch(() => {});
    });
    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(() => {});
  } catch {}
}
function destroyDiscordRPC() {
  if (rpc) { try { rpc.destroy(); } catch {} rpc = null; }
}

/* ── Protocole rloverlay:// ──────────────────────────────────── */
if (process.defaultApp) {
  if (process.argv.length >= 2) app.setAsDefaultProtocolClient('rloverlay', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('rloverlay');
}

/* ── Instance unique ─────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.exit(0); } else {

  app.on('second-instance', (event, argv) => {
    /* .rlstudio ouvert alors que l'app tourne déjà : Studio tout de suite si le panneau est ouvert,
       sinon après la connexion / les CGU */
    const studioFile = findStudioFile(argv);
    if (studioFile) {
      if (mainWindow) { openStudio(studioFile); return; }
      pendingStudioFile = studioFile;
    }
    const win = mainWindow || cguWindow || loginWindow;
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
    handleProtocolArgv(argv);
  });

  /* ── Serveur Express/WebSocket ─────────────────────────────── */
  try {
    srv = require('../server');
    srv.onRestartRequest(() => { app.relaunch(); app.exit(0); });
  } catch (e) {
    dialog.showErrorBox(T('Erreur serveur'), `${T('Impossible de démarrer :')}\n${e.message}`);
    app.exit(1);
  }

  /* ── Langue de l'interface (FR / EN) ──
     Choisie dans le panneau (sinon langue de Windows) ; les fenêtres locales (connexion, CGU, configuration)
     reçoivent le dictionnaire par leur préchargement, le menu de la barre des tâches est reconstruit. */
  ipcMain.on('i18n:get-sync', e => { const lang = curLang(); e.returnValue = { lang, dict: dictFor(lang) }; });
  ipcMain.handle('i18n:get', (e, lang) => { const l = lang === 'en' ? 'en' : 'fr'; return { lang: l, dict: dictFor(l) }; });
  ipcMain.handle('i18n:set', (e, lang) => (srv && srv.setLang ? srv.setLang(lang) : curLang()));
  if (srv && srv.onLangChange) srv.onLangChange(lang => {
    if (tray) tray.setContextMenu(trayMenu());
    for (const w of BrowserWindow.getAllWindows()) { try { w.webContents.send('i18n:changed', lang); } catch {} }
  });

  /* ── Fenêtre de login ──────────────────────────────────────── */
  function createLoginWindow() {
    if (loginWindow) { loginWindow.focus(); return; }
    loginWindow = new BrowserWindow({
      width : 380,
      height: 490,
      resizable   : false,
      maximizable : false,
      title       : T('RL Overlay — Connexion'),
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
      title: T('RL Overlay — Contrôles'),
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

    // Un lien rloverlay:// reçu avant que la fenêtre/le panneau soit prêt est
    // rejoué une fois la page chargée (le temps que le WebSocket se connecte).
    mainWindow.webContents.once('did-finish-load', () => {
      if (pendingProtocolShareId) {
        const shareId = pendingProtocolShareId;
        pendingProtocolShareId = null;
        setTimeout(() => triggerThemeDownload(shareId), 800);
      }
    });

    mainWindow.on('close', e => {
      if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
    });
    hud.registerShortcut();
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  /* ── Ouverture de l'app après connexion : CGU d'abord si le compte ne les a pas encore acceptées ── */
  function openApp(session) {
    createMainWindow(session);
    createTray();
    initDiscordRPC();
    /* app lancée par un double-clic sur un .rlstudio : le Studio s'ouvre ensuite avec ce projet */
    if (pendingStudioFile) {
      const file = pendingStudioFile; pendingStudioFile = null;
      setTimeout(() => openStudio(file), 600);
    }
  }
  /* cguAccepted === false : compte existant qui n'a pas encore accepté les CGU (renvoyé par le site) →
     fenêtre d'acceptation, une seule fois : l'acceptation est enregistrée sur le compte, côté site.
     Valeur absente (site injoignable / ancienne réponse) : on n'empêche pas d'utiliser l'app. */
  let cguWindow = null, cguSession = null, cguDone = false;
  function startSession(session, cguAccepted) {
    if (cguAccepted === false) showCguWindow(session);
    else openApp(session);
  }
  function showCguWindow(session) {
    cguSession = session; cguDone = false;
    if (cguWindow) { cguWindow.focus(); return; }
    cguWindow = new BrowserWindow({
      width: 540, height: 660, useContentSize: true, resizable: false, maximizable: false, minimizable: true,
      title: T('RL Overlay — Conditions générales d\'utilisation'),
      autoHideMenuBar: true, backgroundColor: '#04060c',
      icon: path.join(__dirname, '../public/logos/logo.png'),
      webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
    });
    cguWindow.loadFile(path.join(__dirname, 'cgu.html'));
    /* fermer la fenêtre sans accepter = refuser : l'app se ferme */
    cguWindow.on('closed', () => { cguWindow = null; if (!cguDone) { app.isQuitting = true; app.quit(); } });
  }
  function postCguAccept(key) {
    return new Promise(resolve => {
      const body = JSON.stringify({ key });
      const req = https.request('https://overlay.rscast.fr/api/cgu/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000,
      }, res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ error: T('Réponse invalide du serveur.') }); } });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => resolve({ error: T('Impossible de joindre le serveur, vérifie ta connexion.') }));
      req.end(body);
    });
  }
  ipcMain.handle('cgu:accept', async () => {
    if (!cguSession) return { error: T('Session introuvable, relance l\'application.') };
    const r = await postCguAccept(cguSession.license);
    if (!r || !r.ok) return { error: (r && r.error) || T('Erreur lors de l\'enregistrement.') };
    cguDone = true;
    const session = cguSession; cguSession = null;
    if (cguWindow) cguWindow.destroy();
    openApp(session);
    return { ok: true };
  });
  ipcMain.on('cgu:refuse', () => { app.isQuitting = true; app.quit(); });

  /* ── IPC : login réussi depuis la fenêtre de login ─────────── */
  ipcMain.on('auth-success', (e, data) => {
    const { cguAccepted, ...session } = data || {};
    saveSession(session);
    if (loginWindow) { loginWindow.destroy(); loginWindow = null; }
    startSession(session, cguAccepted);
  });

  /* ── IPC : ouvrir URL dans le navigateur externe ─────────────── */
  ipcMain.on('open-url', (e, url) => {
    if (typeof url === 'string' && url.startsWith('https://overlay.rscast.fr')) {
      /* le site s'ouvre dans la langue de l'app (gardée ensuite par le site) */
      try { const u = new URL(url); if (!u.searchParams.has('lang')) u.searchParams.set('lang', curLang()); url = u.toString(); } catch {}
      shell.openExternal(url);
    }
  });

  /* ── IPC : Studio de thèmes (fenêtre dédiée, plein écran) ────── */
  let studioWindow = null;
  ipcMain.on('open-studio', () => openStudio());
  /* file : projet .rlstudio à ouvrir dans le Studio (double-clic sur le fichier) */
  function openStudio(file) {
    if (studioWindow && !studioWindow.isDestroyed()) {
      if (studioWindow.isMinimized()) studioWindow.restore();
      studioWindow.show(); studioWindow.focus();
      if (file) studioWindow.webContents.send('studio:open-file', file);
      return;
    }
    studioWindow = new BrowserWindow({
      width: 1500, height: 920, minWidth: 1100, minHeight: 680,
      title: T('RL Overlay — Studio de thèmes'),
      autoHideMenuBar: true,
      backgroundColor: '#0b0c10',
      show: false,
      icon: path.join(__dirname, '../public/logos/logo.png'),
      webPreferences: {
        nodeIntegration : false,
        contextIsolation: true,
        preload         : path.join(__dirname, 'preload.js'),
      },
    });
    studioWindow.once('ready-to-show', () => { studioWindow.maximize(); studioWindow.show(); });
    studioWindow.loadURL('http://localhost:3000/studio.html' + (file ? '?open=' + encodeURIComponent(file) : ''));
    studioWindow.on('closed', () => { studioWindow = null; });
  }

  /* ── HUD à l'écran pour le caster (overlay par-dessus le jeu, voir hud.js) ── */
  const hud = require('./hud')({ getMainWindow: () => mainWindow, port: 3000, onChange: () => { if (srv && srv.hudChanged) srv.hudChanged(); } });
  if (srv && srv.setHud) srv.setHud(hud);   // pilotable par l'API (touche « HUD à l'écran » du plugin Stream Deck)

  /* ── IPC : fichiers de projet du Studio (.rlstudio) ──────────────
     Ctrl+S réécrit le fichier déjà ouvert (sans redemander où l'enregistrer) ;
     sans chemin connu (nouveau projet, « Enregistrer sous… ») on ouvre la boîte de dialogue. */
  const STUDIO_FILTERS = () => [{ name: T('Projet Studio RL Overlay'), extensions: ['rlstudio'] }];
  ipcMain.handle('studio:save', async (e, { file, data, suggested } = {}) => {
    let target = file;
    if (!target) {
      const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
        title: T('Enregistrer le projet'),
        defaultPath: path.join(app.getPath('documents'), `${suggested || 'projet'}.rlstudio`),
        filters: STUDIO_FILTERS(),
      });
      if (r.canceled || !r.filePath) return { canceled: true };
      target = r.filePath;
    }
    await fs.promises.writeFile(target, String(data || ''), 'utf8');
    return { file: target };
  });
  ipcMain.handle('studio:open', async (e, { file } = {}) => {
    let target = file;
    if (!target) {
      const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
        title: T('Ouvrir un projet'), properties: ['openFile'], filters: STUDIO_FILTERS(),
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      target = r.filePaths[0];
    }
    return { file: target, data: await fs.promises.readFile(target, 'utf8') };
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
  /* menu de l'icône (reconstruit quand la langue change) */
  function trayMenu() {
    return Menu.buildFromTemplate([
      { label: T('Afficher le panneau'),        click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: T('Ouvrir dans le navigateur'),  click: () => shell.openExternal('http://localhost:3000/controls.html') },
      { type: 'separator' },
      { label: T('Quitter'), click: () => { app.isQuitting = true; app.quit(); } },
    ]);
  }
  function createTray() {
    if (tray) return;
    const img  = nativeImage.createFromPath(path.join(__dirname, '../public/logos/logo.png'));
    const icon = img.resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('RL Overlay');
    tray.setContextMenu(trayMenu());
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
      title      : T('Dossier d\'installation de Rocket League'),
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
        error: `${T('RocketLeague.exe introuvable dans :')}\n${chosen}\\Binaries\\Win64\\\n\n${T('Vérifie que tu as bien sélectionné le dossier RACINE de Rocket League (pas un raccourci, pas un sous-dossier).')}`,
      };
    }

    if (!fs.existsSync(iniPath)) {
      return {
        error: `${T('DefaultStatsAPI.ini introuvable dans :')}\n${chosen}\\TAGame\\Config\\\n\n${T('Le dossier semble invalide.')}`,
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
        title       : T('RL Overlay — Configuration'),
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

  // Lancement initial via rloverlay:// (l'app n'était pas encore ouverte) —
  // mis en attente ici, traité une fois la fenêtre principale prête.
  handleProtocolArgv(process.argv);
  // Lancement initial par un double-clic sur un projet .rlstudio : Studio ouvert après le panneau
  pendingStudioFile = findStudioFile(process.argv);

  /* ── Démarrage ──────────────────────────────────────────────── */
  app.whenReady().then(async () => {
    if (srv && srv.setDefaultLocale) srv.setDefaultLocale(app.getLocale());   // langue de Windows, tant que rien n'est choisi
    registerStudioFileAssociation();   // double-clic sur un .rlstudio → RL Overlay (en arrière-plan)
    // Demande le dossier RL si pas encore configuré, puis vérifie PacketSendRate
    const rlPath = await ensureRLPath();
    if (checkAndFixStatsApi(rlPath)) {
      await dialog.showMessageBox({
        type   : 'warning',
        title  : T('Configuration Rocket League corrigée'),
        message: `${T('Le PacketSendRate a été remis à 100 dans les fichiers de config de Rocket League.')}\n\n${T('Relance Rocket League pour appliquer les changements.')}`,
        buttons: ['OK'],
      });
    }

    const session = readSession();

    if (session && session.license) {
      // Valider la clé en ligne
      const result = await validateKey(session.license);
      if (result.valid) {
        // Mettre à jour le tier et l'avatar depuis le serveur
        const updatedSession = { ...session, tier: result.tier || session.tier || 'basic', avatar_url: result.avatar_url ?? session.avatar_url ?? null };
        saveSession(updatedSession);
        startSession(updatedSession, result.cguAccepted);
        return;
      }
    }

    // Pas de session valide → fenêtre de login
    createLoginWindow();
  });

  app.on('window-all-closed', e => e.preventDefault());
  app.on('activate', () => {
    const win = mainWindow || cguWindow || loginWindow;
    if (win) win.show();
  });
  app.on('before-quit', () => { destroyDiscordRPC(); });
}

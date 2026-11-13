'use strict';
/* ══════════════════════════════════════════════════════════════════════════════
   HUD à l'écran pour le caster
   L'overlay (global.html, comme dans OBS) dans une fenêtre transparente, toujours devant le jeu
   (Rocket League en plein écran fenêtré), que la souris traverse, à l'échelle de l'écran choisi.
   Masquée des captures d'écran par défaut, pour ne pas doubler l'overlay du stream (capture d'écran OBS).
   Chargée sur 127.0.0.1 et pas localhost : son zoom ne touche pas le panneau de contrôle (zoom par hôte).
   Réglages (écran, opacité, masquage des captures) gardés dans hud.json (dossier de l'app).
══════════════════════════════════════════════════════════════════════════════ */
const { BrowserWindow, ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');

const SHORTCUT = 'CommandOrControl+Shift+H';

module.exports = function setupHud({ getMainWindow, port = 3000, file = path.join(app.getPath('userData'), 'hud.json') } = {}) {
  let win = null;
  /* ends : écrans de fin de match et de victoire de série dans le HUD (masqués par défaut : ils couvrent tout le jeu) */
  let opts = { display: null, opacity: 100, protect: true, ends: false };
  try { opts = { ...opts, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  const save = () => { try { fs.writeFileSync(file, JSON.stringify(opts)); } catch {} };
  const shown = () => !!(win && !win.isDestroyed());
  /* ?hud : overlay en mode HUD (global.html masque les écrans de fin / victoire, sauf avec &ends) */
  const url = () => `http://127.0.0.1:${port}/global.html?hud${opts.ends ? '&ends' : ''}`;
  const screen = () => require('electron').screen;   // utilisable seulement une fois l'app prête

  function display() {
    return screen().getAllDisplays().find(d => d.id === opts.display) || screen().getPrimaryDisplay();
  }
  function state() {
    const prim = screen().getPrimaryDisplay().id;
    return {
      shown: shown(), opts: { ...opts },
      displays: screen().getAllDisplays().map((d, i) => ({
        id: d.id,
        label: `Écran ${i + 1} — ${Math.round(d.size.width * d.scaleFactor)}×${Math.round(d.size.height * d.scaleFactor)}${d.id === prim ? ' (principal)' : ''}`,
      })),
    };
  }
  function notify() {
    const mw = getMainWindow && getMainWindow();
    if (mw && !mw.isDestroyed()) mw.webContents.send('hud:state', state());
  }
  function layout() {
    if (!shown()) return;
    const b = display().bounds;
    win.setBounds(b);
    win.setOpacity(Math.max(0.1, Math.min(1, (opts.opacity ?? 100) / 100)));
    win.setContentProtection(opts.protect !== false);
    /* l'overlay est dessiné en 1920×1080 : mis à l'échelle de l'écran (et de la mise à l'échelle Windows) */
    win.webContents.setZoomFactor(Math.min(b.width / 1920, b.height / 1080));
  }
  function show() {
    if (shown()) { layout(); win.showInactive(); notify(); return; }
    const b = display().bounds;
    win = new BrowserWindow({
      x: b.x, y: b.y, width: b.width, height: b.height,
      transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
      focusable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, fullscreenable: false, show: false,
      backgroundColor: '#00000000', title: 'RL Overlay — HUD',
      webPreferences: { nodeIntegration: false, contextIsolation: true, backgroundThrottling: false },
    });
    win.setAlwaysOnTop(true, 'screen-saver');   // au-dessus du jeu en plein écran fenêtré
    win.setIgnoreMouseEvents(true);              // les clics passent au jeu / au bureau
    win.webContents.on('did-finish-load', layout);
    win.once('ready-to-show', () => { layout(); if (shown()) win.showInactive(); notify(); });
    win.on('closed', () => { win = null; notify(); });
    win.loadURL(url());
    notify();
  }
  function hide() { if (shown()) win.destroy(); win = null; notify(); }
  const toggle = () => (shown() ? hide() : show());

  ipcMain.handle('hud:get', () => state());
  ipcMain.handle('hud:set', (e, o = {}) => {
    if (o.display !== undefined) opts.display = o.display;
    if (o.opacity != null) opts.opacity = Math.max(10, Math.min(100, Math.round(+o.opacity) || 100));
    if (o.protect != null) opts.protect = !!o.protect;
    const endsChanged = o.ends != null && !!o.ends !== !!opts.ends;
    if (o.ends != null) opts.ends = !!o.ends;
    save();
    if (endsChanged && shown()) win.loadURL(url());
    if (o.shown === true) show();
    else if (o.shown === false) hide();
    else layout();
    return state();
  });

  /* Ctrl+Maj+H : afficher / masquer le HUD sans quitter le jeu */
  function registerShortcut() {
    const { globalShortcut } = require('electron');
    try { if (!globalShortcut.isRegistered(SHORTCUT)) globalShortcut.register(SHORTCUT, toggle); } catch {}
  }
  app.on('will-quit', () => { try { require('electron').globalShortcut.unregisterAll(); } catch {} });

  return { show, hide, toggle, state, registerShortcut, window: () => win };
};

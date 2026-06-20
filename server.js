const express = require('express');
const http    = require('http');
const net     = require('net');
const WebSocket = require('ws');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');

const PORT           = process.env.PORT           || 3000;
const STATS_API_PORT = process.env.STATS_API_PORT || 49123;

const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const LOGOS_DIR     = path.join(__dirname, 'public', 'logos');
const UTILS_DIR     = path.join(__dirname, 'public', 'utils');
const IMG_EXTS      = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);
const VIDEO_EXTS    = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv']);

fs.mkdirSync(path.join(LOGOS_DIR, 'bleu'),   { recursive: true });
fs.mkdirSync(path.join(LOGOS_DIR, 'orange'), { recursive: true });
fs.mkdirSync(UTILS_DIR, { recursive: true });

/* ── Persistence settings.json ── */
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return {}; }
}
function saveSettings() {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

let settings = readSettings();
settings.mediaBanner = settings.mediaBanner ?? { enabled: false };
let currentTheme = settings.theme || 'rlcs';

function listUtils() {
  try {
    return fs.readdirSync(UTILS_DIR)
      .filter(f => !f.startsWith('.') && (IMG_EXTS.has(path.extname(f).toLowerCase()) || VIDEO_EXTS.has(path.extname(f).toLowerCase())))
      .map(f => ({ name: f, url: `/utils/${encodeURIComponent(f)}`, type: VIDEO_EXTS.has(path.extname(f).toLowerCase()) ? 'video' : 'image' }));
  } catch { return []; }
}

function findLogo(side) {
  try {
    const dir   = path.join(LOGOS_DIR, side);
    const files = fs.readdirSync(dir);
    const img   = files.find(f => IMG_EXTS.has(path.extname(f).toLowerCase()));
    return img ? `/logos/${side}/${img}` : '';
  } catch { return ''; }
}

function applySettings() {
  const s = settings;
  if (s.blue?.name)   { gameState.game.teams[0].name = s.blue.name;   gameState.game.teams[0]._nameLocked = true; }
  if (s.orange?.name) { gameState.game.teams[1].name = s.orange.name; gameState.game.teams[1]._nameLocked = true; }
  if (s.league)       gameState.meta.league        = s.league;
  if (s.bestOf)       gameState.series.bestOf      = s.bestOf;
  if (s.series?.blue   !== undefined) gameState.series.blue   = s.series.blue;
  if (s.series?.orange !== undefined) gameState.series.orange = s.series.orange;
  gameState.game.teams[0].logo_url = findLogo('bleu');
  gameState.game.teams[1].logo_url = findLogo('orange');
  console.log('[Settings] bleu logo  :', gameState.game.teams[0].logo_url || '(aucun)');
  console.log('[Settings] orange logo:', gameState.game.teams[1].logo_url || '(aucun)');
  broadcast('update_state', gameState);
}

const app = express();
app.use(['/logos', '/utils'], (_req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

const server = http.createServer(app);
const overlayWss = new WebSocket.Server({ server });

let statsApiClient       = null;
let gameState            = createDefaultState();
let statsApiTimer        = null;
let statsApiSilenceTimer = null;
let specOverride         = null;
let pendingGoalBroadcast = null;
let pendingGoalTimer     = null;
let roundGoalBroadcast   = false;
let overlayVisible       = true;
let boostVisible         = true;
let _lastStatsBroadcast  = 0;          // throttle UpdateState → ~30 fps max

function flushGoalBroadcast() {
  if (!pendingGoalBroadcast) return;
  broadcast('goal_scored', pendingGoalBroadcast);
  pendingGoalBroadcast = null;
}

function createDefaultState() {
  return {
    game: {
      time: 300, isOT: false, hasWinner: false, winner: '',
      teams: [
        { name: 'BLUE',   score: 0, color_primary: '0,102,255', logo_url: '' },
        { name: 'ORANGE', score: 0, color_primary: '255,140,0', logo_url: '' }
      ],
      players: {}, ballSpeed: 0
    },
    series:  { blue: 0, orange: 0, bestOf: 7 },
    meta:    { league: 'SEMAINE 1 // LIGUE 1' },
    hasGame: false, connected: false, specMode: 'auto'
  };
}

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  overlayWss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

/* ─────────────────── STATS API (49123) — TCP raw ─────────────────── */
function connectToStatsApi() {
  if (statsApiClient) return;
  console.log(`[StatsAPI] Connexion à tcp://localhost:${STATS_API_PORT}...`);

  let buffer = '';
  const socket = net.createConnection(STATS_API_PORT, 'localhost');
  statsApiClient = socket;

  socket.on('connect', () => {
    console.log('[StatsAPI] Connecté');
    gameState.connected = true;
    broadcast('sos_connected', {});
    // Essai handshake WebSocket manuel
    const key = Buffer.from('rloverlay' + Date.now()).toString('base64');
    socket.write(
      'GET / HTTP/1.1\r\n' +
      `Host: localhost:${STATS_API_PORT}\r\n` +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Key: ${key}\r\n` +
      'Sec-WebSocket-Version: 13\r\n\r\n'
    );
  });

  socket.on('data', chunk => {

    clearTimeout(statsApiSilenceTimer);
    statsApiSilenceTimer = setTimeout(() => {
      if (gameState.hasGame) { gameState.hasGame = false; broadcast('update_state', gameState); }
    }, 15000);

    buffer += chunk.toString();

    // Extrait tous les objets JSON complets du buffer (pas de délimiteur garanti)
    let i = 0;
    while (i < buffer.length) {
      if (buffer[i] !== '{') { i++; continue; }
      let depth = 0, inStr = false, esc = false, j = i;
      for (; j < buffer.length; j++) {
        const c = buffer[j];
        if (esc)         { esc = false; continue; }
        if (c === '\\' && inStr) { esc = true; continue; }
        if (c === '"')   { inStr = !inStr; continue; }
        if (inStr)       continue;
        if (c === '{')   depth++;
        else if (c === '}') { if (--depth === 0) break; }
      }
      if (depth === 0 && j < buffer.length) {
        try { handleStatsApiMessage(JSON.parse(buffer.slice(i, j + 1))); } catch (e) {}
        i = j + 1;
      } else break;
    }
    buffer = buffer.slice(i);
  });

  socket.on('close', () => {
    console.log('[StatsAPI] Déconnecté. Retry 5s...');
    clearTimeout(statsApiSilenceTimer);
    statsApiClient = null;
    gameState.connected = false; gameState.hasGame = false;
    broadcast('sos_disconnected', {});
    statsApiTimer = setTimeout(connectToStatsApi, 5000);
  });

  socket.on('error', (err) => {
    console.log('[StatsAPI] Erreur:', err.message, '| code:', err.code);
    clearTimeout(statsApiSilenceTimer);
    statsApiClient = null;
    clearTimeout(statsApiTimer);
    statsApiTimer = setTimeout(connectToStatsApi, 5000);
  });
}

/* ─────────────────── STATS API message handler ─────────────────── */
function handleStatsApiMessage(msg) {
  const event = msg.Event;
  let data = msg.Data || {};
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }

  switch (event) {
    case 'UpdateState': {
      handleStatsApiUpdate(data);
      /* Cap à ~30 fps : inutile d'envoyer 60-80 messages/s au client */
      const _t = Date.now();
      if (_t - _lastStatsBroadcast >= 33) { _lastStatsBroadcast = _t; broadcast('update_state', gameState); }
      break;
    }

    case 'GoalScored': {
      if (roundGoalBroadcast) break; // RL sends GoalScored twice (before & after replay)
      roundGoalBroadcast = true;
      const sc  = data.Scorer   || {};
      const as  = data.Assister || {};
      const spd = data.GoalSpeed ?? gameState.game.ballSpeed ?? 0;
      clearTimeout(pendingGoalTimer);
      pendingGoalBroadcast = {
        scorer:    { team_num: sc.TeamNum ?? -1, name: sc.Name || '' },
        assister:  as.Name || '',
        ballSpeed: spd, teams: gameState.game.teams, ts: Date.now()
      };
      pendingGoalTimer = setTimeout(flushGoalBroadcast, 300);
      break;
    }

    case 'StatfeedEvent': {
      const mt   = data.MainTarget;
      const st   = data.SecondaryTarget;
      const rawType = (data.Type || data.EventName || '').toLowerCase();
      // Normalise les types français envoyés par l'API officielle RL
      const TYPE_FR = {
        'but': 'goal', 'tir cadré': 'shot on goal', 'tir': 'shot on goal',
        'arrêt': 'save', 'arrêt miraculeux': 'epic save', 'arrêt épique': 'epic save',
        'passe décisive': 'assist', 'démolition': 'demolition',
      };
      const type = TYPE_FR[rawType] || rawType;
      if (mt?.Name) {
        const player = Object.values(gameState.game.players).find(p => p.name === mt.Name);
        // Ne pas incrémenter ici — UpdateState de l'API fournit les vrais chiffres
        if (type === 'assist') {
          if (pendingGoalBroadcast && Date.now() - pendingGoalBroadcast.ts < 4000) {
            clearTimeout(pendingGoalTimer);
            pendingGoalBroadcast.assister = mt.Name || '';
            flushGoalBroadcast();
          }
        }
        const playerId = player?.id || mt.Name;
        const stName = st?.Name || st?.name || '';
        const victimPlayer = stName ? Object.values(gameState.game.players).find(p => p.name === stName) : null;
        broadcast('stat_event', {
          playerId, playerName: mt.Name || '', type,
          secondaryId: victimPlayer?.id || stName,
          secondaryName: stName
        });
      }
      break;
    }

    case 'MatchCreated':
    case 'MatchInitialized':
      specOverride = null; roundGoalBroadcast = false;
      gameState.specMode = 'auto'; gameState.hasGame = true;
      gameState.game.players = {};
      broadcast('match_created', {}); broadcast('update_state', gameState);
      break;

    case 'CountdownBegin':
      roundGoalBroadcast = false; // new round starting — allow next goal
      gameState.hasGame = true;
      broadcast('pre_countdown', {});
      break;

    case 'RoundStarted':
      gameState.hasGame = true;
      broadcast('update_state', gameState);
      break;

    case 'GoalReplayStart':
    case 'GoalReplayWillEnd':
    case 'GoalReplayEnd':
      break;

    case 'MatchEnded': {
      gameState.hasGame = false;
      const winner = data.WinnerTeamNum ?? -1;
      if (winner === 0) { gameState.series.blue++;   settings.series = { ...(settings.series||{}), blue:   gameState.series.blue   }; saveSettings(); broadcast('series_update', gameState.series); }
      if (winner === 1) { gameState.series.orange++;  settings.series = { ...(settings.series||{}), orange: gameState.series.orange }; saveSettings(); broadcast('series_update', gameState.series); }
      if (winner === 0 || winner === 1) {
        broadcast('game_end_stats', { winner, teams: gameState.game.teams, series: gameState.series, players: gameState.game.players });
      }
      broadcast('match_ended', { winner });
      break;
    }

    case 'MatchDestroyed':
      gameState.hasGame = false; broadcast('match_ended', { winner: -1 }); break;

    case 'PodiumStart':
      gameState.hasGame = false; broadcast('match_ended', {}); break;
  }
}

function handleStatsApiUpdate(data) {
  const g       = data.Game    || {};
  const players = data.Players || [];

  gameState.game.time      = g.TimeSeconds ?? gameState.game.time;
  gameState.game.isOT      = g.bOvertime   || false;
  gameState.game.hasWinner = g.bHasWinner  || false;
  gameState.game.ballSpeed = g.Ball?.Speed  ?? gameState.game.ballSpeed ?? 0;
  gameState.hasGame        = true;

  (g.Teams || []).forEach(t => {
    const idx = t.TeamNum;
    if (idx !== 0 && idx !== 1) return;
    gameState.game.teams[idx].score = t.Score ?? 0;
    const n = t.Name || '';
    if (!gameState.game.teams[idx]._nameLocked && n && n !== 'Blue' && n !== 'Orange' && n !== `${idx}`)
      gameState.game.teams[idx].name = n;
  });

  const seenIds = new Set();
  players.forEach(p => {
    const name = p.Name || '';
    const team = typeof p.TeamNum === 'number' ? p.TeamNum : Number(p.TeamNum ?? 0);
    // Use team+name as key — PrimaryId can be shared across bots ("Bot") causing collisions
    const id = `${team}_${name}`;
    seenIds.add(id);
    if (gameState.game.players[id]) {
      const ep = gameState.game.players[id];
      ep.name     = name     || ep.name;
      ep.team     = team;
      ep.score    = p.Score    ?? ep.score;
      ep.goals    = p.Goals    ?? ep.goals;
      ep.assists  = p.Assists  ?? ep.assists;
      ep.saves    = p.Saves    ?? ep.saves;
      ep.shots    = p.Shots    ?? ep.shots;
      ep.demos    = p.Demos    ?? ep.demos;
      ep.boost    = p.Boost    ?? ep.boost;
      ep.speed    = p.Speed    ?? ep.speed;
      ep.shortcut = p.Shortcut ?? ep.shortcut;
    } else {
      gameState.game.players[id] = {
        id, name: name || id, team,
        score: p.Score ?? 0, goals: p.Goals ?? 0, assists: p.Assists ?? 0,
        saves: p.Saves ?? 0, shots: p.Shots ?? 0, demos: p.Demos ?? 0,
        boost: p.Boost ?? 0, speed: p.Speed ?? 0,
        shortcut: p.Shortcut ?? null, isPrimary: false
      };
    }
  });
  Object.keys(gameState.game.players).forEach(k => { if (!seenIds.has(k)) delete gameState.game.players[k]; });

  if (specOverride === null) {
    if (g.bHasTarget && g.Target?.Name) {
      Object.values(gameState.game.players).forEach(p => { p.isPrimary = false; });
      const target = Object.values(gameState.game.players).find(p => p.name === g.Target.Name);
      if (target) target.isPrimary = true;
    } else {
      Object.values(gameState.game.players).forEach(p => { p.isPrimary = false; });
    }
  }
}


/* ─────────────────── OVERLAY CLIENTS ─────────────────── */
overlayWss.on('connection', ws => {
  console.log('[Overlay] Client connecté');
  ws.send(JSON.stringify({ type: 'init', data: gameState }));
  ws.send(JSON.stringify({ type: 'theme_change', data: { theme: currentTheme } }));
  ws.send(JSON.stringify({ type: 'media_banner', data: { enabled: settings.mediaBanner?.enabled ?? false } }));
  ws.send(JSON.stringify({ type: 'utils_updated', data: { files: listUtils() } }));
  ws.send(JSON.stringify({ type: 'overlay_visible', data: { visible: overlayVisible } }));
  ws.send(JSON.stringify({ type: 'boost_visible',   data: { visible: boostVisible } }));
  ws.on('close', () => console.log('[Overlay] Client déconnecté'));
});

/* ─────────────────── REST API ─────────────────── */
app.get('/api/state', (req, res) => res.json(gameState));

app.get('/api/settings', (req, res) => res.json(settings));

app.post('/api/settings', (req, res) => {
  const { league, blue, orange, bestOf, series } = req.body;
  if (league !== undefined)     settings.league = league;
  if (blue?.name !== undefined) { settings.blue = { ...(settings.blue || {}), name: blue.name }; gameState.game.teams[0]._nameLocked = true; }
  if (orange?.name !== undefined) { settings.orange = { ...(settings.orange || {}), name: orange.name }; gameState.game.teams[1]._nameLocked = true; }
  if (bestOf !== undefined)     settings.bestOf = bestOf;
  if (series !== undefined)     settings.series = series;
  saveSettings();
  applySettings();
  res.json({ ok: true });
});

app.post('/api/upload-logo/:side', upload.single('logo'), (req, res) => {
  const side = req.params.side;
  if (!['bleu', 'orange'].includes(side)) return res.status(400).json({ error: 'invalid side' });
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!IMG_EXTS.has(ext)) return res.status(400).json({ error: 'invalid type' });
  const dir = path.join(LOGOS_DIR, side);
  try { fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f))); } catch {}
  fs.writeFileSync(path.join(dir, `logo${ext}`), req.file.buffer);
  const url = findLogo(side);
  gameState.game.teams[side === 'bleu' ? 0 : 1].logo_url = url;
  broadcast('update_state', gameState);
  broadcast('logo_updated', { side, url });
  res.json({ ok: true, url });
});

app.post('/api/delete-logo/:side', (req, res) => {
  const side = req.params.side;
  if (!['bleu', 'orange'].includes(side)) return res.status(400).json({ error: 'invalid side' });
  const dir = path.join(LOGOS_DIR, side);
  try { fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f))); } catch {}
  gameState.game.teams[side === 'bleu' ? 0 : 1].logo_url = '';
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/media-banner', (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  const { enabled } = req.body;
  settings.mediaBanner = { enabled: !!enabled };
  saveSettings();
  broadcast('media_banner', { enabled: !!enabled });
  res.json({ ok: true });
});

app.post('/api/swap-teams', (req, res) => {
  const n0 = gameState.game.teams[0].name;
  const n1 = gameState.game.teams[1].name;
  gameState.game.teams[0].name = n1;
  gameState.game.teams[1].name = n0;
  settings.blue   = { ...(settings.blue   || {}), name: n1 };
  settings.orange = { ...(settings.orange || {}), name: n0 };

  const bleuDir   = path.join(LOGOS_DIR, 'bleu');
  const orangeDir = path.join(LOGOS_DIR, 'orange');
  const tmpDir    = path.join(LOGOS_DIR, '_swap_tmp');
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.readdirSync(bleuDir).forEach(f   => fs.renameSync(path.join(bleuDir,   f), path.join(tmpDir,    f)));
    fs.readdirSync(orangeDir).forEach(f => fs.renameSync(path.join(orangeDir, f), path.join(bleuDir,   f)));
    fs.readdirSync(tmpDir).forEach(f    => fs.renameSync(path.join(tmpDir,    f), path.join(orangeDir, f)));
    fs.rmdirSync(tmpDir);
  } catch {}

  gameState.game.teams[0].logo_url = findLogo('bleu');
  gameState.game.teams[1].logo_url = findLogo('orange');
  saveSettings();
  broadcast('update_state', gameState);
  broadcast('teams_swapped', { teams: gameState.game.teams });
  res.json({ ok: true, teams: gameState.game.teams });
});

app.get('/api/utils', (req, res) => res.json(listUtils()));

app.post('/api/upload-utils', upload.single('file'), (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!IMG_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) return res.status(400).json({ error: 'invalid type' });
  fs.writeFileSync(path.join(UTILS_DIR, req.file.originalname), req.file.buffer);
  const files = listUtils();
  broadcast('utils_updated', { files });
  res.json({ ok: true, files });
});

app.post('/api/delete-utils', (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  const { name } = req.body;
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.'))
    return res.status(400).json({ error: 'invalid name' });
  try { fs.unlinkSync(path.join(UTILS_DIR, name)); } catch {}
  const files = listUtils();
  broadcast('utils_updated', { files });
  res.json({ ok: true, files });
});

app.get('/api/debug', (req, res) => {
  res.json({
    players: gameState.game.players,
    connected: gameState.connected,
    hasGame: gameState.hasGame,
    specOverride
  });
});

app.post('/api/spectate-shortcut', (req, res) => {
  const n = parseInt(req.body.shortcut);
  const list = Object.values(gameState.game.players);
  const match = list.find(p => p.shortcut === n);
  if (match) { specOverride = match.name; gameState.specMode = 'manual'; list.forEach(p => { p.isPrimary = false; }); match.isPrimary = true; broadcast('update_state', gameState); res.json({ ok: true, name: match.name }); }
  else res.json({ ok: false, error: 'shortcut not found' });
});

app.post('/api/spectate-player', (req, res) => {
  const { name } = req.body;
  specOverride = name; gameState.specMode = 'manual';
  const list = Object.values(gameState.game.players);
  list.forEach(p => { p.isPrimary = false; });
  const match = list.find(p => p.name.toLowerCase() === (name || '').toLowerCase());
  if (match) match.isPrimary = true;
  broadcast('update_state', gameState);
  res.json({ ok: true, found: !!match });
});

app.post('/api/spectate-clear', (_req, res) => {
  specOverride = 'clear'; gameState.specMode = 'clear';
  Object.values(gameState.game.players).forEach(p => { p.isPrimary = false; });
  delete gameState.game.players['__manual_spec__'];
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/teams', (req, res) => {
  const { blue, orange, league } = req.body;
  if (blue)   { gameState.game.teams[0] = { ...gameState.game.teams[0], ...blue }; if (blue.name) { settings.blue = { ...(settings.blue||{}), name: blue.name }; gameState.game.teams[0]._nameLocked = true; } }
  if (orange) { gameState.game.teams[1] = { ...gameState.game.teams[1], ...orange }; if (orange.name) { settings.orange = { ...(settings.orange||{}), name: orange.name }; gameState.game.teams[1]._nameLocked = true; } }
  if (league) { gameState.meta.league = league; settings.league = league; }
  saveSettings();
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/spectate', (req, res) => {
  const { name, team, goals, assists, shots, saves, demos, boost, speed } = req.body;
  const id = '__manual_spec__';
  Object.keys(gameState.game.players).forEach(k => { if (gameState.game.players[k].isPrimary) gameState.game.players[k].isPrimary = false; });
  gameState.game.players[id] = { id, name: name || 'PLAYER', team: team ?? 0, score: 0, goals: goals ?? 0, assists: assists ?? 0, shots: shots ?? 0, saves: saves ?? 0, demos: demos ?? 0, boost: boost ?? 0, speed: speed ?? 0, isPrimary: true };
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/score', (req, res) => {
  const { blue, orange } = req.body;
  if (blue   !== undefined) gameState.game.teams[0].score = blue;
  if (orange !== undefined) gameState.game.teams[1].score = orange;
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/series', (req, res) => {
  const { blue, orange, bestOf } = req.body;
  if (blue   !== undefined) { gameState.series.blue   = blue;   settings.series = { ...(settings.series||{}), blue }; }
  if (orange !== undefined) { gameState.series.orange = orange; settings.series = { ...(settings.series||{}), orange }; }
  if (bestOf !== undefined) { gameState.series.bestOf = bestOf; settings.bestOf = bestOf; }
  saveSettings();
  broadcast('series_update', gameState.series);
  res.json({ ok: true });
});

app.post('/api/time', (req, res) => {
  const { time, isOT } = req.body;
  if (time !== undefined) gameState.game.time = time;
  if (isOT !== undefined) gameState.game.isOT = isOT;
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/reset', (req, res) => {
  specOverride = null;
  gameState = createDefaultState();
  applySettings();
  broadcast('init', gameState);
  res.json({ ok: true });
});

app.post('/api/overlay-visible', (req, res) => {
  overlayVisible = req.body.visible !== false;
  broadcast('overlay_visible', { visible: overlayVisible });
  res.json({ ok: true });
});

const THEMES_DIR = path.join(__dirname, 'public', 'themes');
fs.mkdirSync(THEMES_DIR, { recursive: true });

function listThemes() {
  const builtin = ['rlcs'];
  try {
    const dirs = fs.readdirSync(THEMES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(THEMES_DIR, d.name, 'theme.css')))
      .map(d => d.name);
    return [...new Set([...builtin, ...dirs])];
  } catch { return builtin; }
}

app.get('/api/themes', (req, res) => {
  res.json({ themes: listThemes(), current: currentTheme });
});

app.post('/api/theme', (req, res) => {
  const theme = req.body.theme;
  if (!listThemes().includes(theme)) return res.status(400).json({ error: 'invalid theme' });
  currentTheme = theme;
  settings.theme = theme;
  saveSettings();
  broadcast('theme_change', { theme });
  res.json({ ok: true });
});

app.post('/api/themes/import', upload.single('css'), (req, res) => {
  const file = req.file;
  const name = (req.body.name || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!file || !name) return res.status(400).json({ error: 'name et fichier CSS requis' });
  const themeDir = path.join(THEMES_DIR, name);
  fs.mkdirSync(themeDir, { recursive: true });
  let css = file.buffer.toString('utf8');
  // Détecter le thème source avant renommage
  const baseMatch = css.match(/\[data-theme="([^"]+)"\]/);
  const basedOn   = baseMatch ? baseMatch[1] : null;
  // Réécrire les sélecteurs avec le nouveau nom
  css = css.replace(/\[data-theme="[^"]*"\]/g, `[data-theme="${name}"]`);
  fs.writeFileSync(path.join(themeDir, 'theme.css'), css);
  // Sauver les métadonnées (thème d'origine pour les comportements JS)
  if (basedOn && basedOn !== name) {
    fs.writeFileSync(path.join(themeDir, 'meta.json'), JSON.stringify({ basedOn }, null, 2));
  }
  res.json({ ok: true, name, basedOn });
});

app.delete('/api/themes/:name', (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
  const builtinProtected = ['rlcs'];
  if (builtinProtected.includes(name)) return res.status(403).json({ error: 'thème protégé' });
  const themeDir = path.join(THEMES_DIR, name);
  if (fs.existsSync(themeDir)) fs.rmSync(themeDir, { recursive: true });
  if (currentTheme === name) {
    currentTheme = 'rlcs'; settings.theme = 'rlcs'; saveSettings();
    broadcast('theme_change', { theme: 'rlcs' });
  }
  res.json({ ok: true });
});

app.post('/api/boost-visible', (req, res) => {
  boostVisible = req.body.visible !== false;
  broadcast('boost_visible', { visible: boostVisible });
  res.json({ ok: true });
});

app.post('/api/goal', (req, res) => {
  const { team } = req.body;
  if (team === 0 || team === 1) {
    gameState.game.teams[team].score++;
    broadcast('goal_scored', { scorer: { team_num: team, name: 'Manual' }, teams: gameState.game.teams });
    broadcast('update_state', gameState);
  }
  res.json({ ok: true });
});

app.get('/api/version', (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    res.json({ version: pkg.version });
  } catch { res.json({ version: '?' }); }
});

/* ── Session auth (set by Electron main) ── */
let _session = null;
exports.setSession = (s) => { _session = s; };

app.get('/api/session', (req, res) => {
  if (!_session) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    username : _session.username,
    tier     : _session.tier || 'basic',
    license  : _session.license,
  });
});

/* ── Auto-update ── */
let _restartCallback = null;
exports.onRestartRequest = (cb) => { _restartCallback = cb; };

app.post('/api/update', async (req, res) => {
  const https  = require('https');
  const os     = require('os');
  const { execFileSync } = require('child_process');

  const ZIP_URL    = 'https://codeload.github.com/NorXV1/RL-Overlay/zip/refs/heads/main';
  const tmpZip     = path.join(os.tmpdir(), 'rl-overlay-update.zip');
  const tmpDir     = path.join(os.tmpdir(), 'rl-overlay-update');
  const REPO_SUB   = 'RL-Overlay-main';

  function skipPath(rel) {
    const p = rel.split(path.sep);
    if (['node_modules','dist','.git','.claude','.vs'].includes(p[0])) return true;
    if (p[0] === 'settings.json') return true;
    if (p[0] === 'public' && p[1] === 'logos' && p[2]) return true;
    if (p[0] === 'public' && p[1] === 'utils') return true;
    return false;
  }

  function copyDir(src, dst) {
    const rel = path.relative(path.join(tmpDir, REPO_SUB), src);
    if (rel && skipPath(rel)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) copyDir(path.join(src, f), path.join(dst, f));
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }

  try {
    // 1. Télécharger le zip
    await new Promise((resolve, reject) => {
      function get(url) {
        https.get(url, r => {
          if (r.statusCode === 301 || r.statusCode === 302) return get(r.headers.location);
          const file = fs.createWriteStream(tmpZip);
          r.pipe(file);
          file.on('finish', resolve);
          r.on('error', reject);
        }).on('error', reject);
      }
      get(ZIP_URL);
    });

    // 2. Extraire avec PowerShell
    fs.rmSync(tmpDir, { recursive: true, force: true });
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${tmpDir}' -Force`
    ]);

    // 3. Copier les fichiers (sans écraser les données utilisateur)
    copyDir(path.join(tmpDir, REPO_SUB), __dirname);

    // 4. Nettoyer
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpZip, { force: true });

    res.json({ ok: true, output: 'Mise à jour installée. Redémarrage…' });
    if (_restartCallback) setTimeout(_restartCallback, 1500);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 RL Overlay running at http://localhost:${PORT}`);
  console.log(`   Global   : http://localhost:${PORT}/global.html`);
  console.log(`   Controls : http://localhost:${PORT}/controls.html`);
  console.log(`   Stats API: ws://localhost:${STATS_API_PORT}\n`);
  applySettings();
  fs.watch(path.join(LOGOS_DIR, 'bleu'),   () => setTimeout(applySettings, 200));
  fs.watch(path.join(LOGOS_DIR, 'orange'), () => setTimeout(applySettings, 200));
  connectToStatsApi();
});

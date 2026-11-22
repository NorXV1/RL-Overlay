const express = require('express');
const http    = require('http');
const net     = require('net');
const { StringDecoder } = require('string_decoder');
const WebSocket = require('ws');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const yauzl   = require('yauzl');

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

const _isFreshInstall = !fs.existsSync(SETTINGS_PATH); // avant toute écriture de settings.json
let settings = readSettings();
settings.mediaBanner = settings.mediaBanner ?? { enabled: false };
settings.mediaBanner.interval = settings.mediaBanner.interval ?? 60; // secondes par média du bandeau
settings.keepPlayerLinks = settings.keepPlayerLinks ?? false;
settings.playerLinks = settings.keepPlayerLinks ? (settings.playerLinks || {}) : {}; // remis à zéro à chaque démarrage sauf si "Conserver au redémarrage" est activé
settings.playerVideoEnabled = settings.playerVideoEnabled ?? false;
settings.playerVideoHideEmpty = settings.playerVideoHideEmpty ?? false; // joueur sans lien caméra : rien au lieu de l'image de remplacement
settings.animations = { goal: true, replay: true, live: true, endScreen: true, ...(settings.animations || {}) };
settings.reviewSubmitted = settings.reviewSubmitted ?? false;
settings.themeNames = settings.themeNames || {}; // noms affichés choisis dans le panneau ({ dossier: "Nom" })
/* Groupes de médias du bandeau (ex. sponsors d'un tournoi) : [{ id, name, files: [noms de fichiers] }].
   settings.mediaBanner.group = groupe affiché (null = tous les médias) */
settings.mediaGroups = Array.isArray(settings.mediaGroups) ? settings.mediaGroups : [];
settings.mediaBanner.group = settings.mediaBanner.group ?? null;

/* ── Thèmes supprimés de RL Overlay ──
   Identifiants d'anciens thèmes fournis par RSCast et retirés : ils servent uniquement à nettoyer les
   installations existantes (thème actif → Default, nom personnalisé, dossier laissé par une mise à jour,
   thèmes importés et projets du Studio « basés sur » eux). */
const REMOVED_THEMES = new Set(['vitality', 'blue-and-yellow']);
if (settings.theme && REMOVED_THEMES.has(settings.theme)) settings.theme = 'rlcs';
for (const id of REMOVED_THEMES) delete settings.themeNames[id];
let currentTheme = settings.theme || 'rlcs';
saveSettings();

function listUtils() {
  try {
    return fs.readdirSync(UTILS_DIR)
      .filter(f => !f.startsWith('.') && (IMG_EXTS.has(path.extname(f).toLowerCase()) || VIDEO_EXTS.has(path.extname(f).toLowerCase())))
      .map(f => ({ name: f, url: `/utils/${encodeURIComponent(f)}`, type: VIDEO_EXTS.has(path.extname(f).toLowerCase()) ? 'video' : 'image' }));
  } catch { return []; }
}

/* Médias passés dans le bandeau : ceux du groupe choisi (dans l'ordre du groupe), sinon tous */
function activeUtils() {
  const all = listUtils();
  const g = settings.mediaGroups.find(x => x.id === settings.mediaBanner.group);
  if (!g) return all;
  return g.files.map(n => all.find(f => f.name === n)).filter(Boolean);
}
/* message 'utils_updated' : tous les fichiers (panneau), ceux du bandeau (overlay), les groupes */
const utilsPayload = () => ({ files: listUtils(), active: activeUtils(), groups: settings.mediaGroups, group: settings.mediaBanner.group || null });

function findLogo(side) {
  try {
    const dir   = path.join(LOGOS_DIR, side);
    const files = fs.readdirSync(dir);
    const img   = files.find(f => IMG_EXTS.has(path.extname(f).toLowerCase()));
    return img ? `/logos/${side}/${img}` : '';
  } catch { return ''; }
}

/* ── Noms d'équipe ──
   Priorité : 1) nom saisi dans le panneau ; 2) nom envoyé par le jeu (club, match privé, tournoi) ;
   3) BLUE / ORANGE. Un champ vide dans le panneau = automatique : on peut toujours y revenir. */
const DEFAULT_TEAM_NAMES = ['BLUE', 'ORANGE'];
/* noms génériques envoyés par le jeu pour une équipe sans nom (toutes langues courantes) */
const GENERIC_TEAM_NAMES = new Set(['', '0', '1', 'blue', 'orange', 'bleu', 'bleue', 'blau', 'azul', 'naranja', 'arancione', 'blu',
  'team blue', 'team orange', 'blue team', 'orange team', 'équipe bleue', 'équipe orange', 'equipe bleue', 'equipe orange']);
let gameTeamNames = ['', ''];   // dernier vrai nom d'équipe détecté en jeu (vidé à chaque nouveau match)

function manualTeamName(idx) {
  const s = idx === 0 ? settings.blue : settings.orange;
  return String(s?.name ?? '').trim();
}
/* Tag d'équipe (abréviation affichée par certains thèmes) : 4 caractères max, optionnel.
   Vide = automatique (les 4 premières lettres du nom, côté overlay). */
const TEAM_TAG_MAX = 4;
const cleanTeamTag = v => [...String(v ?? '').replace(/\s+/g, ' ').trim()].slice(0, TEAM_TAG_MAX).join('').trim();
function manualTeamTag(idx) {
  return cleanTeamTag((idx === 0 ? settings.blue : settings.orange)?.tag);
}
function refreshTeamName(idx) {
  const team   = gameState.game.teams[idx];
  const manual = manualTeamName(idx);
  team.name       = manual || gameTeamNames[idx] || DEFAULT_TEAM_NAMES[idx];
  team.nameSource = manual ? 'manual' : (gameTeamNames[idx] ? 'game' : 'default');
  team.tag        = manualTeamTag(idx);
}

function applySettings() {
  const s = settings;
  refreshTeamName(0);
  refreshTeamName(1);
  if (s.league !== undefined) gameState.meta.league = s.league;
  if (s.bestOf !== undefined && s.bestOf !== null) gameState.series.bestOf = Number(s.bestOf) || 0;   // 0 = sans BO
  if (s.series?.blue   !== undefined) gameState.series.blue   = s.series.blue;
  if (s.series?.orange !== undefined) gameState.series.orange = s.series.orange;
  gameState.game.teams[0].logo_url = findLogo('bleu');
  gameState.game.teams[1].logo_url = findLogo('orange');
  console.log('[Settings] bleu logo  :', gameState.game.teams[0].logo_url || '(aucun)');
  console.log('[Settings] orange logo:', gameState.game.teams[1].logo_url || '(aucun)');
  broadcast('update_state', gameState);
}

const app = express();
/* ── Requêtes venant d'un autre site : refusées ──
   L'API locale et le flux en direct (WebSocket) ne servent qu'aux pages de l'app elle-même (panneau, overlay OBS,
   Studio, pages de vote / scores — même adresse) et aux programmes du PC (pas d'en-tête Origin). Une page web
   ouverte ailleurs (un site dans le navigateur, ou une page chargée dans l'overlay par un lien vidéo) ne peut ni
   envoyer de fichier, ni modifier les réglages, ni écouter le flux (qui contient le lien et le code de la salle
   de contrôle). L'adresse doit être locale ou du réseau privé : un nom de domaine public qui pointerait vers le
   PC (« DNS rebinding ») est refusé. */
const PRIVATE_HOST_RE = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-z0-9-]+(?:\.local)?)(?::\d+)?$/i;
function sameOriginOk(origin, host) {
  if (!origin) return true;                                  // programme du PC (pas une page web)
  if (!host || !PRIVATE_HOST_RE.test(String(host))) return false;
  try {
    const o = new URL(origin);
    return (o.protocol === 'http:' || o.protocol === 'https:') && o.host.toLowerCase() === String(host).toLowerCase();
  } catch { return false; }                                  // « null » (iframe isolée, fichier local…) : refusé
}
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (sameOriginOk(req.headers.origin, req.headers.host)) return next();
  res.status(403).json({ error: 'Accès refusé : requête venant d\'un autre site' });
});
app.use(['/logos', '/utils'], (_req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '25mb' }));   // projets du Studio (CSS + calques) : bien au-delà des 100 ko par défaut

/* ── Langue de l'interface (FR / EN) ──
   Dictionnaires public/i18n/fr.json et en.json (clé = texte français d'origine). settings.lang = choix fait
   dans le panneau ; sans choix, la langue de Windows (français → FR, sinon EN).
   /i18n/boot.js : dictionnaire de la langue + traducteur (public/i18n/runtime.js), chargé en tête des pages. */
const I18N_DIR = path.join(__dirname, 'public', 'i18n');
const LANGS = ['fr', 'en'];
const langOfLocale = loc => /^fr/i.test(String(loc || '')) ? 'fr' : 'en';
let detectedLang = (() => { try { return langOfLocale(Intl.DateTimeFormat().resolvedOptions().locale); } catch { return 'fr'; } })();
const currentLang = () => LANGS.includes(settings.lang) ? settings.lang : detectedLang;
function readDict(lang) {
  try { return JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8')); }
  catch (e) { console.warn('[i18n]', lang, e.message); return {}; }
}
let _langCallback = null;
function setLang(lang) {
  if (!LANGS.includes(lang)) return currentLang();
  settings.lang = lang;
  saveSettings();
  broadcast('lang_change', { lang });
  if (_langCallback) try { _langCallback(lang); } catch (e) { console.warn('[i18n]', e.message); }
  return lang;
}
app.get('/i18n/boot.js', (req, res) => {
  const lang = LANGS.includes(req.query.lang) ? req.query.lang : currentLang();
  let runtime = '';
  try { runtime = fs.readFileSync(path.join(I18N_DIR, 'runtime.js'), 'utf8'); } catch {}
  res.set('Cache-Control', 'no-store').type('application/javascript')
    .send(`window.__I18N_BOOT=${JSON.stringify({ lang, dict: readDict(lang) })};\n${runtime}`);
});
app.get('/api/lang', (req, res) => res.json({ lang: currentLang(), langs: LANGS }));
app.post('/api/lang', (req, res) => res.json({ lang: setLang(req.body && req.body.lang) }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 } // 1 Go — les thèmes avec vidéos (fond.mp4) peuvent dépasser 200 Mo
});

const server = http.createServer(app);
/* flux en direct : seulement pour les pages de l'app (voir sameOriginOk) */
const overlayWss = new WebSocket.Server({ server, verifyClient: info => sameOriginOk(info.origin, info.req.headers.host) });

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
let _statsFlushTimer     = null;

/* Envoie l'état à l'overlay au plus toutes les 33 ms (~30 fps), SANS perdre la dernière
   mise à jour : si un paquet arrive trop tôt, l'envoi est programmé à la fin de la fenêtre
   avec l'état le plus récent. Avant, ces paquets étaient simplement ignorés, ce qui rendait
   l'affichage irrégulier et pouvait laisser une valeur périmée à l'écran. */
function scheduleStateBroadcast() {
  const wait = 33 - (Date.now() - _lastStatsBroadcast);
  if (wait <= 0) {
    clearTimeout(_statsFlushTimer); _statsFlushTimer = null;
    _lastStatsBroadcast = Date.now();
    broadcast('update_state', gameState);
  } else if (!_statsFlushTimer) {
    _statsFlushTimer = setTimeout(() => {
      _statsFlushTimer = null;
      _lastStatsBroadcast = Date.now();
      broadcast('update_state', gameState);
    }, wait);
  }
}

function flushGoalBroadcast() {
  if (!pendingGoalBroadcast) return;
  broadcast('goal_scored', pendingGoalBroadcast);
  pendingGoalBroadcast = null;
  gcGoalShown();   // clip du but : coupé avant l'animation REPLAY qui suit
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
  /* Décodeur UTF-8 à état : un caractère accentué (ou emoji) coupé entre deux paquets TCP
     est recollé, au lieu de devenir un caractère invalide qui faisait échouer le JSON. */
  const decoder = new StringDecoder('utf8');
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

    buffer += decoder.write(chunk);

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
      /* Cap à ~30 fps : inutile d'envoyer les 100 messages/s du jeu au client */
      scheduleStateBroadcast();
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
      gcOnGoal({ team: sc.TeamNum, scorer: sc.Name, assister: as.Name, speed: spd });   // clip du but (OBS)
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
          gcAssist(mt.Name);
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
      gcNewMatch();   // clips des buts du match précédent effacés
      /* nouveau match : on oublie les noms détectés du match précédent */
      gameTeamNames = ['', ''];
      refreshTeamName(0); refreshTeamName(1);
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
      /* Sans BO (bestOf = 0) : pas de série, on ne compte pas les manches */
      const counts = !!gameState.series.bestOf;
      if (counts && winner === 0) { gameState.series.blue++;   settings.series = { ...(settings.series||{}), blue:   gameState.series.blue   }; saveSettings(); broadcast('series_update', gameState.series); }
      if (counts && winner === 1) { gameState.series.orange++;  settings.series = { ...(settings.series||{}), orange: gameState.series.orange }; saveSettings(); broadcast('series_update', gameState.series); }
      if (winner === 0 || winner === 1) {
        broadcast('game_end_stats', { winner, teams: gameState.game.teams, series: gameState.series, players: gameState.game.players });
        recordGameResult(winner, counts);   // historique de la série (page des scores)
        gcOnMatchEnd();                     // scores, puis clips des buts
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
    /* Nom détecté en jeu (utilisé seulement si aucun nom n'est saisi dans le panneau) */
    const n = String(t.Name ?? '').trim();
    gameTeamNames[idx] = GENERIC_TEAM_NAMES.has(n.toLowerCase()) ? '' : n;
    refreshTeamName(idx);
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
      ep.link     = settings.playerLinks[ep.name] || '';
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
        link: settings.playerLinks[name || id] || '',
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
  ws.send(JSON.stringify({ type: 'media_banner', data: { enabled: settings.mediaBanner?.enabled ?? false, interval: settings.mediaBanner.interval } }));
  ws.send(JSON.stringify({ type: 'utils_updated', data: utilsPayload() }));
  ws.send(JSON.stringify({ type: 'overlay_visible', data: { visible: overlayVisible } }));
  ws.send(JSON.stringify({ type: 'boost_visible',   data: { visible: boostVisible } }));
  ws.send(JSON.stringify({ type: 'player_video_toggle', data: { enabled: settings.playerVideoEnabled, hideEmpty: settings.playerVideoHideEmpty } }));
  ws.send(JSON.stringify({ type: 'animations_settings', data: settings.animations }));
  ws.send(JSON.stringify({ type: 'twitch_poll', data: pollPayload() }));
  ws.send(JSON.stringify({ type: 'timeouts', data: timeoutsState() }));
  ws.send(JSON.stringify({ type: 'goal_clips', data: gcState() }));
  ws.send(JSON.stringify({ type: 'remote_room', data: remotePayload() }));
  ws.send(JSON.stringify({ type: 'review_status', data: { submitted: settings.reviewSubmitted } }));
  ws.send(JSON.stringify({ type: 'season', data: { season: currentSeason } }));
  ws.on('close', () => console.log('[Overlay] Client déconnecté'));
});

/* ─────────────────── THÈME SAISONNIER ───────────────────
   Noël / Halloween, activé depuis le panneau admin du site : relu toutes les minutes et
   diffusé au panneau de contrôle (message 'season'). La dernière valeur connue est gardée
   dans settings.json pour s'appliquer même si le site ne répond pas au démarrage. */
const SEASONS = ['christmas', 'halloween'];
let currentSeason = SEASONS.includes(settings.season) ? settings.season : '';

async function refreshSeason() {
  try {
    const r = await fetch('https://overlay.rscast.fr/api/season', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const { season } = await r.json();
    const next = SEASONS.includes(season) ? season : '';
    if (next === currentSeason) return;
    currentSeason = next;
    settings.season = next;
    saveSettings();
    broadcast('season', { season: next });
  } catch {}
}
refreshSeason();
setInterval(refreshSeason, 60 * 1000);

app.get('/api/season', (req, res) => res.json({ season: currentSeason }));

/* ─────────────────── REST API ─────────────────── */
app.get('/api/state', (req, res) => res.json(gameState));

app.get('/api/settings', (req, res) => res.json({
  ...settings,
  goalClips: settings.goalClips ? { ...settings.goalClips, password: undefined } : undefined,   // mot de passe d'OBS : jamais renvoyé
  // Injecter les logo_url depuis le gameState (non stockés dans settings.json)
  teams: [
    { name: gameState.game.teams[0].name, logo_url: gameState.game.teams[0].logo_url || '' },
    { name: gameState.game.teams[1].name, logo_url: gameState.game.teams[1].logo_url || '' },
  ],
}));

app.post('/api/settings', (req, res) => {
  const { league, blue, orange, bestOf, series } = req.body;
  if (league !== undefined)     settings.league = league;
  /* nom vide = retour au nom automatique (détecté en jeu) — appliqué par applySettings() */
  if (blue?.name   !== undefined) settings.blue   = { ...(settings.blue   || {}), name: String(blue.name   ?? '').trim() };
  if (orange?.name !== undefined) settings.orange = { ...(settings.orange || {}), name: String(orange.name ?? '').trim() };
  if (blue?.tag    !== undefined) settings.blue   = { ...(settings.blue   || {}), tag: cleanTeamTag(blue.tag) };
  if (orange?.tag  !== undefined) settings.orange = { ...(settings.orange || {}), tag: cleanTeamTag(orange.tag) };
  if (bestOf !== undefined)     settings.bestOf = bestOf;
  if (series !== undefined)     settings.series = series;
  if (series && !series.blue && !series.orange) { settings.seriesHistory = []; resetTimeouts(); }
  saveSettings();
  applySettings();
  broadcast('scores_update', scoresPayload());
  res.json({ ok: true });
});

app.post('/api/upload-logo/:side', upload.single('logo'), (req, res) => {
  const side = req.params.side;
  if (!['bleu', 'orange'].includes(side)) return res.status(400).json({ error: 'invalid side' });
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!IMG_EXTS.has(ext)) return res.status(400).json({ error: 'invalid type' });
  res.json({ ok: true, url: setTeamLogo(side, req.file.buffer, ext) });
});
/* logo d'équipe remplacé (panneau, salle de contrôle à distance) */
function setTeamLogo(side, buffer, ext) {
  const dir = path.join(LOGOS_DIR, side);
  try { fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f))); } catch {}
  fs.writeFileSync(path.join(dir, `logo${ext}`), buffer);
  const url = findLogo(side);
  gameState.game.teams[side === 'bleu' ? 0 : 1].logo_url = url;
  broadcast('update_state', gameState);
  broadcast('logo_updated', { side, url });
  return url;
}

app.post('/api/delete-logo/:side', (req, res) => {
  const side = req.params.side;
  if (!['bleu', 'orange'].includes(side)) return res.status(400).json({ error: 'invalid side' });
  const dir = path.join(LOGOS_DIR, side);
  try { fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f))); } catch {}
  gameState.game.teams[side === 'bleu' ? 0 : 1].logo_url = '';
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

/* Active/désactive le bandeau et/ou règle la durée d'affichage de chaque média (3 s → 1 h) */
app.post('/api/media-banner', (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  const { enabled, interval, group } = req.body || {};
  if (interval !== undefined) {
    const sec = Math.round(Number(interval));
    if (!Number.isFinite(sec) || sec < 3 || sec > 3600) return res.status(400).json({ error: 'Durée entre 3 et 3600 secondes' });
    settings.mediaBanner.interval = sec;
  }
  if (enabled !== undefined) settings.mediaBanner.enabled = !!enabled;
  /* groupe de médias affiché (null = tous) */
  if (group !== undefined) {
    if (group !== null && !settings.mediaGroups.some(g => g.id === group)) return res.status(404).json({ error: 'Groupe introuvable' });
    settings.mediaBanner.group = group;
  }
  saveSettings();
  broadcast('media_banner', { enabled: settings.mediaBanner.enabled, interval: settings.mediaBanner.interval });
  if (group !== undefined) broadcast('utils_updated', utilsPayload());
  res.json({ ok: true, mediaBanner: settings.mediaBanner, ...utilsPayload() });
});

/* Groupes de médias : créer, renommer, supprimer, ranger / retirer un fichier, réordonner */
app.get('/api/media-groups', (req, res) => res.json({ ok: true, ...utilsPayload() }));
app.post('/api/media-groups', (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  const { action, id, name, file, on, files } = req.body || {};
  const groups = settings.mediaGroups;
  const g = groups.find(x => x.id === id);
  const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (action === 'create') {
    const nm = cleanName(name);
    if (!nm) return res.status(400).json({ error: 'Nom du groupe requis' });
    const ng = { id: 'g' + Date.now().toString(36), name: nm, files: [] };
    groups.push(ng);
    saveSettings(); broadcast('utils_updated', utilsPayload());
    return res.json({ ok: true, created: ng.id, ...utilsPayload() });
  }
  if (!g) return res.status(404).json({ error: 'Groupe introuvable' });
  if (action === 'rename') {
    const nm = cleanName(name);
    if (!nm) return res.status(400).json({ error: 'Nom du groupe requis' });
    g.name = nm;
  } else if (action === 'delete') {
    settings.mediaGroups = groups.filter(x => x !== g);
    if (settings.mediaBanner.group === g.id) settings.mediaBanner.group = null;
  } else if (action === 'toggle') {
    const f = path.basename(String(file || ''));
    if (!listUtils().some(u => u.name === f)) return res.status(404).json({ error: 'Fichier introuvable' });
    g.files = g.files.filter(n => n !== f);
    if (on) g.files.push(f);
  } else if (action === 'order') {
    /* nouvel ordre de passage dans le bandeau (fichiers du groupe uniquement) */
    if (!Array.isArray(files)) return res.status(400).json({ error: 'Liste requise' });
    g.files = files.map(String).filter(n => g.files.includes(n)).concat(g.files.filter(n => !files.includes(n)));
  } else return res.status(400).json({ error: 'Action inconnue' });
  saveSettings(); broadcast('utils_updated', utilsPayload());
  res.json({ ok: true, ...utilsPayload() });
});

app.post('/api/swap-teams', (req, res) => {
  /* On inverse les noms SAISIS (pas les noms affichés) : un nom automatique reste automatique,
     au lieu d'être figé dans les réglages (ex. "BLUE" enregistré comme nom de l'équipe orange). */
  const m0 = manualTeamName(0), m1 = manualTeamName(1);
  const t0 = manualTeamTag(0),  t1 = manualTeamTag(1);
  settings.blue   = { ...(settings.blue   || {}), name: m1, tag: t1 };
  settings.orange = { ...(settings.orange || {}), name: m0, tag: t0 };
  refreshTeamName(0); refreshTeamName(1);
  /* le timeout déjà pris suit son équipe */
  { const to = toCfg(); if (to.used[0] !== to.used[1]) { if (toLive) toLive.team = 1 - toLive.team; settings.timeouts = { ...to, used: [to.used[1], to.used[0]] }; timeoutsBroadcast(); } }

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

/* ?active=1 : seulement les médias du groupe affiché dans le bandeau (overlay) */
app.get('/api/utils', (req, res) => res.json(req.query.active ? activeUtils() : listUtils()));

app.post('/api/upload-utils', upload.single('file'), (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!IMG_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) return res.status(400).json({ error: 'invalid type' });
  const name = path.basename(req.file.originalname);
  fs.writeFileSync(path.join(UTILS_DIR, name), req.file.buffer);
  /* envoyé depuis un groupe ouvert : le fichier y est rangé directement */
  const g = settings.mediaGroups.find(x => x.id === req.body.group);
  if (g && !g.files.includes(name)) { g.files.push(name); saveSettings(); }
  const payload = utilsPayload();
  broadcast('utils_updated', payload);
  res.json({ ok: true, ...payload });
});

app.post('/api/delete-utils', (req, res) => {
  if ((_session?.tier || 'basic') !== 'premium') return res.status(403).json({ error: 'premium_required' });
  const { name } = req.body;
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.'))
    return res.status(400).json({ error: 'invalid name' });
  try { fs.unlinkSync(path.join(UTILS_DIR, name)); } catch {}
  /* retiré aussi de tous les groupes */
  let changed = false;
  settings.mediaGroups.forEach(g => { if (g.files.includes(name)) { g.files = g.files.filter(n => n !== name); changed = true; } });
  if (changed) saveSettings();
  const payload = utilsPayload();
  broadcast('utils_updated', payload);
  res.json({ ok: true, ...payload });
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

app.post('/api/player-link', (req, res) => {
  const { name, url } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (url) settings.playerLinks[name] = url;
  else delete settings.playerLinks[name];
  saveSettings();
  const p = Object.values(gameState.game.players).find(p => p.name === name);
  if (p) p.link = url || '';
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/keep-player-links', (req, res) => {
  settings.keepPlayerLinks = !!req.body.enabled;
  saveSettings();
  res.json({ ok: true, enabled: settings.keepPlayerLinks });
});

app.post('/api/player-video-toggle', (req, res) => {
  settings.playerVideoEnabled = !!req.body.enabled;
  saveSettings();
  broadcast('player_video_toggle', { enabled: settings.playerVideoEnabled, hideEmpty: settings.playerVideoHideEmpty });
  res.json({ ok: true, enabled: settings.playerVideoEnabled });
});

/* Joueur sans caméra configurée : ne rien afficher (cadre et caméras de replay) au lieu de l'image de remplacement */
app.post('/api/player-video-hide-empty', (req, res) => {
  settings.playerVideoHideEmpty = !!req.body.hide;
  saveSettings();
  broadcast('player_video_toggle', { enabled: settings.playerVideoEnabled, hideEmpty: settings.playerVideoHideEmpty });
  res.json({ ok: true, hide: settings.playerVideoHideEmpty });
});

app.post('/api/animations', (req, res) => {
  const { goal, replay, live, endScreen } = req.body;
  if (goal      !== undefined) settings.animations.goal      = !!goal;
  if (replay    !== undefined) settings.animations.replay    = !!replay;
  if (live      !== undefined) settings.animations.live      = !!live;
  if (endScreen !== undefined) settings.animations.endScreen = !!endScreen;
  saveSettings();
  broadcast('animations_settings', settings.animations);
  res.json({ ok: true, animations: settings.animations });
});

/* Relaie l'avis vers overlay.rscast.fr (identifié via la clé de licence de la session) */
function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

app.post('/api/submit-review', async (req, res) => {
  if (settings.reviewSubmitted) return res.status(409).json({ error: 'Vous avez déjà laissé un avis' });
  if (!_session?.license) return res.status(401).json({ error: 'Non connecté' });

  const rating = parseInt(req.body?.rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Note invalide' });
  const review = String(req.body?.review || '').trim().slice(0, 600);
  if (!review) return res.status(400).json({ error: 'Merci de décrire votre avis' });
  const suggestion = String(req.body?.suggestion || '').trim().slice(0, 600);

  try {
    const r = await postJSON('https://overlay.rscast.fr/api/reviews', { license: _session.license, rating, review, suggestion });
    // un seul avis par compte : déjà voté depuis un autre PC / une autre installation
    if (r.status === 409) {
      settings.reviewSubmitted = true;
      saveSettings();
      broadcast('review_status', { submitted: true });
      return res.status(409).json({ error: 'Tu as déjà laissé un avis avec ce compte', alreadySubmitted: true });
    }
    if (r.status !== 200 || !r.body?.ok) return res.status(r.status || 500).json({ error: r.body?.error || 'Erreur serveur' });
    settings.reviewSubmitted = true;
    saveSettings();
    broadcast('review_status', { submitted: true });
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: 'Impossible de contacter le serveur' });
  }
});

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    }).on('error', reject);
  });
}

/* Télécharge un fichier en mémoire en suivant la progression (0-100) via callback.
   Suit les redirections (302) puisque le téléchargement passe par un CDN/proxy. */
function downloadWithProgress(url, onProgress) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const get = (u) => {
      https.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) return reject(new Error('Téléchargement échoué (HTTP ' + res.statusCode + ')'));
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const chunks = [];
        res.on('data', c => {
          chunks.push(c);
          received += c.length;
          if (total > 0) onProgress(Math.min(99, Math.floor(received / total * 100)));
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

/* Un avis par COMPTE (pas par installation) : à l'ouverture du panneau, le site dit si le compte
   connecté a un avis actif (pending/approved). Il fait foi dans les deux sens — avis laissé depuis
   un autre PC ou une autre installation → plus de demande ici ; avis refusé ou supprimé par
   l'admin → le bouton réapparaît. Sans réponse du site (hors ligne), on garde la valeur locale. */
app.get('/api/review-status/refresh', async (req, res) => {
  let checked = false;
  if (_session?.license) {
    try {
      const r = await getJSON(`https://overlay.rscast.fr/api/reviews/mine?license=${encodeURIComponent(_session.license)}`);
      if (r.status === 200) {
        checked = true;
        const active = r.body?.status === 'pending' || r.body?.status === 'approved';
        if (active !== settings.reviewSubmitted) {
          settings.reviewSubmitted = active;
          saveSettings();
          broadcast('review_status', { submitted: active });
        }
      }
    } catch {}
  }
  res.json({ submitted: settings.reviewSubmitted, checked });
});

app.post('/api/teams', (req, res) => {
  const { blue, orange, league } = req.body;
  /* { name: '' } = repasser en nom automatique (détecté en jeu) */
  [[blue, 0, 'blue'], [orange, 1, 'orange']].forEach(([t, idx, key]) => {
    if (!t) return;
    const { name, tag, nameSource, ...rest } = t;
    Object.assign(gameState.game.teams[idx], rest);
    if (name !== undefined) settings[key] = { ...(settings[key] || {}), name: String(name ?? '').trim() };
    if (tag !== undefined)  settings[key] = { ...(settings[key] || {}), tag: cleanTeamTag(tag) };   // '' = tag automatique
    refreshTeamName(idx);
  });
  if (league !== undefined) { gameState.meta.league = league; settings.league = league; }
  saveSettings();
  broadcast('update_state', gameState);
  res.json({ ok: true });
});

app.post('/api/spectate', (req, res) => {
  const { name, team, goals, assists, shots, saves, demos, boost, speed } = req.body;
  const id = '__manual_spec__';
  Object.keys(gameState.game.players).forEach(k => { if (gameState.game.players[k].isPrimary) gameState.game.players[k].isPrimary = false; });
  gameState.game.players[id] = { id, name: name || 'PLAYER', team: team ?? 0, link: settings.playerLinks[name || 'PLAYER'] || '', score: 0, goals: goals ?? 0, assists: assists ?? 0, shots: shots ?? 0, saves: saves ?? 0, demos: demos ?? 0, boost: boost ?? 0, speed: speed ?? 0, isPrimary: true };
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
  /* série remise à 0 - 0 : nouvel historique de games, timeouts rendus */
  if (!gameState.series.blue && !gameState.series.orange) { settings.seriesHistory = []; resetTimeouts(); }
  saveSettings();
  broadcast('series_update', gameState.series);
  broadcast('scores_update', scoresPayload());
  res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════
   TIMEOUTS — pause tactique, comme en RLCS
   Un timeout par équipe et par série. Tant qu'il est disponible, l'overlay montre une icône pause côté
   équipe ; quand l'équipe le prend (bouton TO du panneau ou salle de contrôle), l'icône clignote puis
   disparaît. Désactivable (réglage « Timeouts »). Rendus quand la série repart à 0 - 0, inversés avec les équipes.
   Écran de timeout (désactivable) : image plein écran aux couleurs du thème avec le compte à rebours
   (durée réglable, 2 min par défaut) — le serveur tient le temps ; à 0, l'overlay revient au match.
   Musique (désactivable) : fichier choisi dans le panneau (public/timeout/), jouée par l'overlay OBS
   pendant l'écran, avec un fondu à la fin. Non livrée avec l'app : chacun met la sienne.
═══════════════════════════════════════════════════════════ */
const TIMEOUT_DIR = path.join(__dirname, 'public', 'timeout');
fs.mkdirSync(TIMEOUT_DIR, { recursive: true });
const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.flac', '.opus', '.webm']);
const TO_DURATIONS = [30, 60, 90, 120, 150, 180, 240, 300];
let toLive = null, toLiveT = null;   // écran en cours : { team, duration, endsAt }

/* réglages enregistrés (settings.timeouts) */
function toCfg() {
  const t = settings.timeouts || {}, u = Array.isArray(t.used) ? t.used : [];
  return {
    enabled: !!t.enabled, used: [!!u[0], !!u[1]],
    screen: t.screen !== false, duration: TO_DURATIONS.includes(+t.duration) ? +t.duration : 120,
    music: t.music !== false, volume: Number.isFinite(+t.volume) && t.volume !== '' && t.volume != null ? Math.max(0, Math.min(100, Math.round(+t.volume))) : 70,
    musicFile: typeof t.musicFile === 'string' ? path.basename(t.musicFile) : '', musicName: typeof t.musicName === 'string' ? t.musicName : '',
  };
}
/* état envoyé au panneau, à l'overlay et à la salle : réglages + musique présente + écran en cours (temps restant) */
function timeoutsState() {
  const c = toCfg();
  let musicVer = 0;
  if (c.musicFile) { try { musicVer = Math.round(fs.statSync(path.join(TIMEOUT_DIR, c.musicFile)).mtimeMs); } catch { c.musicFile = ''; c.musicName = ''; } }
  return { ...c, musicVer, live: toLive ? { team: toLive.team, duration: toLive.duration, remaining: Math.max(0, toLive.endsAt - Date.now()) } : null };
}
/* announce : équipe qui vient de prendre son timeout (son icône clignote) */
function timeoutsBroadcast(announce) {
  broadcast('timeouts', { ...timeoutsState(), ...(announce === 0 || announce === 1 ? { announce } : {}) });
  remoteSchedulePush();   // page de la salle de contrôle à jour
}
function toStopScreen() { clearTimeout(toLiveT); toLiveT = null; const was = !!toLive; toLive = null; return was; }
function toStartScreen(team) {
  const c = toCfg();
  toStopScreen();
  if (!c.screen) return;
  gcStopReel();   // clips des buts en cours : l'écran de timeout passe devant (les clips s'arrêtent)
  toLive = { team, duration: c.duration, endsAt: Date.now() + c.duration * 1000 };
  toLiveT = setTimeout(() => { toLive = null; toLiveT = null; timeoutsBroadcast(); }, c.duration * 1000);
}
function resetTimeouts() {
  const t = toCfg();
  if (!t.used[0] && !t.used[1] && !toLive) return;
  toStopScreen();
  settings.timeouts = { ...t, used: [false, false] };
  timeoutsBroadcast();
}
app.get('/api/timeouts', (req, res) => res.json(timeoutsState()));
/* { enabled } active / désactive · { team: 0|1, used: true|false } prend / rend le timeout d'une équipe · { reset: true } rend les deux
   { screen, duration, music, volume } réglages de l'écran et de la musique · { stop: true } termine l'écran en cours
   { removeMusic: true } retire la musique */
app.post('/api/timeouts', (req, res) => {
  const { enabled, team, used, reset, screen, duration, music, volume, stop, removeMusic } = req.body || {};
  const t = toCfg();
  let announce;
  if (enabled !== undefined) { t.enabled = !!enabled; if (!t.enabled) toStopScreen(); }
  if (screen !== undefined) { t.screen = !!screen; if (!t.screen) toStopScreen(); }
  if (duration !== undefined) { if (!TO_DURATIONS.includes(+duration)) return res.status(400).json({ error: 'Durée invalide' }); t.duration = +duration; }
  if (music !== undefined) t.music = !!music;
  if (volume !== undefined && Number.isFinite(+volume)) t.volume = Math.max(0, Math.min(100, Math.round(+volume)));
  if (removeMusic) { for (const f of fs.readdirSync(TIMEOUT_DIR)) try { fs.unlinkSync(path.join(TIMEOUT_DIR, f)); } catch {} t.musicFile = ''; t.musicName = ''; }
  if (stop) toStopScreen();
  if (reset) { t.used = [false, false]; toStopScreen(); }
  if (team !== undefined) {
    const i = Number(team);
    if (i !== 0 && i !== 1) return res.status(400).json({ error: 'Équipe inconnue' });
    if (!t.enabled) return res.status(400).json({ error: 'Les timeouts sont désactivés', timeouts: timeoutsState() });
    const take = used !== false;
    if (take && t.used[i]) return res.status(409).json({ error: 'Cette équipe a déjà pris son timeout', timeouts: timeoutsState() });
    t.used[i] = take;
    settings.timeouts = t;
    if (take) { announce = i; toStartScreen(i); }
    else if (toLive && toLive.team === i) toStopScreen();   // timeout annulé : son écran s'arrête
  }
  settings.timeouts = t; saveSettings();
  timeoutsBroadcast(announce);
  res.json({ ok: true, timeouts: timeoutsState() });
});
/* musique de l'écran de timeout : un seul fichier, remplacé à chaque envoi */
const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1 } });
app.post('/api/timeout-music', (req, res) => uploadAudio.single('music')(req, res, err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop lourd (40 Mo max)' : err.message });
  const ext = path.extname((req.file && req.file.originalname) || '').toLowerCase();
  if (!req.file || !AUDIO_EXTS.has(ext)) return res.status(400).json({ error: 'Fichier audio uniquement (mp3, ogg, wav, m4a, flac…)' });
  for (const f of fs.readdirSync(TIMEOUT_DIR)) try { fs.unlinkSync(path.join(TIMEOUT_DIR, f)); } catch {}
  const file = 'music' + ext;
  fs.writeFileSync(path.join(TIMEOUT_DIR, file), req.file.buffer);
  settings.timeouts = { ...toCfg(), musicFile: file, musicName: path.basename(req.file.originalname).slice(0, 120) };
  saveSettings();
  timeoutsBroadcast();
  res.json({ ok: true, timeouts: timeoutsState() });
}));

/* ═══════════════════════════════════════════════════════════
   CLIPS DES BUTS — comme les RLCS
   À chaque but, l'app demande à OBS d'enregistrer les dernières secondes (Replay Buffer, piloté par le
   WebSocket d'OBS, intégré depuis OBS 28). À la fin du match : l'écran de fin (scores) reste 10 s, puis
   l'overlay passe les clips des buts l'un après l'autre en plein écran (sans son, bandeau REPLAY aux
   couleurs du thème), puis revient aux scores. Désactivable (réglage « Clips des buts »).
   OBS doit tourner sur ce PC : l'app lit les fichiers enregistrés. Chaque clip est déplacé dans goal-clips/
   et effacé au match suivant (« Garder une copie » : l'original reste aussi dans le dossier d'OBS).
   Le serveur tient le temps (comme l'écran de timeout) : intro, puis chaque clip (transition + durée
   réglable), puis sortie — découpage GC_REEL repris tel quel par l'overlay.
═══════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const GC_DIR = process.env.GOAL_CLIPS_DIR || path.join(__dirname, 'goal-clips');
const GC_SCORES = [5, 10, 15, 20, 30];          // durée des scores avant les clips (s)
const GC_CLIPS  = [5, 6, 8, 10, 12, 15];        // durée de chaque clip (s) — il s'arrête juste après le but
/* Le clip est demandé à OBS 0,7 s après l'affichage du but par l'overlay : l'animation REPLAY de l'overlay
   (et sa barre, ses caméras) démarre 1 s après cet affichage → elle n'apparaît jamais dans le clip (marge
   d'environ 0,3 s, OBS n'enregistre que les images déjà capturées). Le début de l'explosion du but y est. */
const GC_SAVE_AFTER_SHOWN = 700;
const GC_SHOW_MAX_WAIT = 300;                   // l'affichage du but suit l'événement du jeu de 300 ms au plus (passe décisive attendue)
const GC_REEL = { intro: 2200, trans: 700, outro: 900 };
const GC_PLAYABLE = new Set(['.mp4', '.m4v', '.mov', '.webm']);   // lus par le navigateur d'OBS (MKV, FLV, TS : non)
const GC_MAX = 30;                              // clips max par match
const OBS_HOST = '127.0.0.1';
try { fs.mkdirSync(GC_DIR, { recursive: true }); for (const f of fs.readdirSync(GC_DIR)) fs.rmSync(path.join(GC_DIR, f), { force: true }); } catch {}

function gcCfg() {
  const g = settings.goalClips || {};
  return {
    enabled: !!g.enabled,
    port: Number.isInteger(+g.port) && +g.port > 0 && +g.port < 65536 ? +g.port : 4455,
    password: typeof g.password === 'string' ? g.password : '',
    scoresSec: GC_SCORES.includes(+g.scoresSec) ? +g.scoresSec : 10,
    clipSec: GC_CLIPS.includes(+g.clipSec) ? +g.clipSec : 8,
    keep: !!g.keep,
  };
}

/* ── Client WebSocket d'OBS (protocole v5) ──
   status : off · connecting · down (OBS fermé / WebSocket désactivé) · auth (mot de passe) ·
   nobuffer (Replay Buffer désactivé dans les réglages d'OBS) · ok */
const obs = { ws: null, ready: false, rb: false, startedRb: false, status: 'off', version: '', sig: '', seq: 0, reqs: new Map(), retryT: null, rbT: null, noPass: false };
function obsStatus(status) { if (obs.status !== status) { obs.status = status; gcBroadcast(); } }
function obsRetry(status, ms) {
  obsStatus(status);
  clearTimeout(obs.retryT);
  if (gcCfg().enabled) obs.retryT = setTimeout(obsConnect, ms);
}
function obsDropReqs() { for (const r of obs.reqs.values()) { clearTimeout(r.t); r.ko(new Error('OBS déconnecté')); } obs.reqs.clear(); }
function obsDisconnect() {
  clearTimeout(obs.retryT); clearTimeout(obs.rbT);
  const w = obs.ws;
  obs.ws = null; obs.ready = false; obs.rb = false;
  obsDropReqs();
  if (w) try { w.terminate(); } catch {}
}
function obsConnect() {
  const c = gcCfg();
  clearTimeout(obs.retryT);
  if (!c.enabled || obs.ws) return;
  obs.sig = `${c.port}|${c.password}`;
  let ws;
  try { ws = new WebSocket(`ws://${OBS_HOST}:${c.port}`, { handshakeTimeout: 4000, maxPayload: 16 * 1024 * 1024 }); }
  catch { return obsRetry('down', 5000); }
  obs.ws = ws; obs.noPass = false;
  if (obs.status !== 'ok') obsStatus('connecting');
  ws.on('message', raw => {
    if (obs.ws !== ws) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const d = (m && m.d) || {};
    if (m.op === 0) {                                   // Hello → Identify (+ mot de passe si demandé)
      const id = { rpcVersion: 1, eventSubscriptions: 1 << 6 };   // événements « Outputs » (Replay Buffer)
      const a = d.authentication;
      if (a) {
        if (!c.password) { obs.noPass = true; try { ws.close(); } catch {} return; }
        const secret = crypto.createHash('sha256').update(c.password + a.salt).digest('base64');
        id.authentication = crypto.createHash('sha256').update(secret + a.challenge).digest('base64');
      }
      ws.send(JSON.stringify({ op: 1, d: id }));
    } else if (m.op === 2) { obs.ready = true; obsOnReady(); }
    else if (m.op === 7) {
      const r = obs.reqs.get(d.requestId);
      if (!r) return;
      obs.reqs.delete(d.requestId); clearTimeout(r.t);
      const st = d.requestStatus || {};
      if (st.result) r.ok(d.responseData || {}); else r.ko(Object.assign(new Error(st.comment || `OBS : erreur ${st.code}`), { code: st.code }));
    } else if (m.op === 5) obsOnEvent(d.eventType, d.eventData || {});
  });
  ws.on('close', code => {
    if (obs.ws !== ws) return;                          // ancienne connexion (réglages changés)
    const wasReady = obs.ready;
    obs.ws = null; obs.ready = false; obs.rb = false;
    obsDropReqs(); clearTimeout(obs.rbT);
    if (!gcCfg().enabled) return obsStatus('off');
    if (code === 4009 || obs.noPass) return obsRetry('auth', 30000);   // mot de passe faux ou manquant
    obsRetry('down', wasReady ? 2000 : 5000);
  });
  ws.on('error', () => {});                             // « close » suit toujours
}
function obsReq(requestType, requestData, ms = 5000) {
  return new Promise((ok, ko) => {
    if (!obs.ws || !obs.ready) return ko(new Error('OBS non connecté'));
    const requestId = 'gc' + (++obs.seq);
    const t = setTimeout(() => { obs.reqs.delete(requestId); ko(new Error('OBS ne répond pas')); }, ms);
    obs.reqs.set(requestId, { ok, ko, t });
    try { obs.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData: requestData || {} } })); }
    catch (e) { obs.reqs.delete(requestId); clearTimeout(t); ko(e); }
  });
}
async function obsOnReady() {
  try { obs.version = (await obsReq('GetVersion')).obsVersion || ''; } catch {}
  obsEnsureRb();
}
/* Replay Buffer lancé par l'app s'il ne tourne pas ; désactivé dans les réglages d'OBS : on réessaie
   toutes les 8 s (le temps que le streamer le coche dans OBS) */
async function obsEnsureRb() {
  clearTimeout(obs.rbT);
  if (!obs.ready || !gcCfg().enabled) return;
  try {
    const s = await obsReq('GetReplayBufferStatus');
    if (!s.outputActive) { await obsReq('StartReplayBuffer'); obs.startedRb = true; }
    obs.rb = true; obsStatus('ok');
  } catch (e) {
    if (!obs.ready) return;
    obs.rb = false; obsStatus('nobuffer');
    obs.rbT = setTimeout(obsEnsureRb, 8000);
  }
}
function obsOnEvent(type, d) {
  if (type === 'ReplayBufferSaved') gcOnSaved(d.savedReplayPath);
  else if (type === 'ReplayBufferStateChanged') {
    if (d.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED') { obs.rb = true; obsStatus('ok'); }
    else if (d.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
      obs.rb = false;
      /* arrêté dans OBS (ou réglages de sortie appliqués) : relancé tant que les clips sont activés */
      if (gcCfg().enabled) { obsStatus('nobuffer'); clearTimeout(obs.rbT); obs.rbT = setTimeout(obsEnsureRb, 3000); }
    }
  }
}

/* ── Clips du match en cours ── */
let gcClips = [];                  // dans l'ordre des buts
const gcWaiting = [];              // clips demandés à OBS, en attente du fichier (dans l'ordre des demandes)
let gcReel = null, gcReelT = null, gcEndT = null;
const gcDrop = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); return i >= 0; };
const gcPub = c => ({
  id: c.id, n: c.n, team: c.team, scorer: c.scorer, assister: c.assister, speed: c.speed, clock: c.clock, ot: c.ot, score: c.score,
  status: c.status, error: c.error || '', warn: c.warn || '', url: c.status === 'ready' ? `/goal-clips/${c.id}${c.ext}` : '',
});
const gcReelMs = (n, clipSec) => GC_REEL.intro + n * (GC_REEL.trans + clipSec * 1000) + GC_REEL.outro;
function gcState() {
  const c = gcCfg();
  return {
    enabled: c.enabled, port: c.port, hasPassword: !!c.password, scoresSec: c.scoresSec, clipSec: c.clipSec, keep: c.keep,
    obs: { status: c.enabled ? obs.status : 'off', version: obs.version },
    clips: gcClips.map(gcPub),
    reel: gcReel ? { id: gcReel.id, startIn: gcReel.t0 - Date.now(), clipSec: gcReel.clipSec, clips: gcReel.clips, final: gcReel.final, ...GC_REEL } : null,
  };
}
function gcBroadcast() { broadcast('goal_clips', gcState()); }
function gcFail(clip, msg) { clip.status = 'error'; clip.error = msg; gcBroadcast(); }

/* but marqué : le clip est demandé à OBS juste avant l'animation REPLAY de l'overlay.
   g.shown = le but vient d'être affiché par l'overlay (sinon il le sera au plus tard 300 ms après) */
function gcOnGoal(g) {
  if (!gcCfg().enabled || gcClips.length >= GC_MAX) return;
  const team = g.team === 0 || g.team === 1 ? g.team : -1;
  const clip = {
    id: crypto.randomBytes(8).toString('hex'), n: gcClips.length + 1, team,
    scorer: String(g.scorer || '').slice(0, 40), assister: String(g.assister || '').slice(0, 40), speed: Math.max(0, Math.round(+g.speed || 0)),
    clock: Math.max(0, Math.round(+gameState.game.time || 0)), ot: !!gameState.game.isOT, score: [0, 0],
    status: 'pending', goalAt: Date.now(), before: gameState.game.teams.map(t => +t.score || 0),
  };
  gcClips.push(clip);
  gcBroadcast();
  clip.saveT = setTimeout(() => gcSave(clip), (g.shown ? 0 : GC_SHOW_MAX_WAIT) + GC_SAVE_AFTER_SHOWN);
}
/* but affiché par l'overlay (message goal_scored) : son animation REPLAY part 1 s plus tard → clip demandé à +0,7 s */
function gcGoalShown() {
  const c = gcClips[gcClips.length - 1];
  if (!c || c.status !== 'pending' || c.reqAt || Date.now() - c.goalAt > 1500) return;
  clearTimeout(c.saveT);
  c.saveT = setTimeout(() => gcSave(c), GC_SAVE_AFTER_SHOWN);
}
/* passe décisive reçue juste après le but */
function gcAssist(name) {
  const c = gcClips[gcClips.length - 1];
  if (c && !c.assister && name && name !== c.scorer && Date.now() - c.goalAt < 6000) { c.assister = String(name).slice(0, 40); gcBroadcast(); }
}
async function gcSave(clip) {
  if (!gcClips.includes(clip) || clip.reqAt) return;         // nouveau match entre-temps / déjà demandé
  clip.reqAt = Date.now();
  const t = gameState.game.teams, cur = [+t[0].score || 0, +t[1].score || 0], b = clip.before;
  /* équipe inconnue (envoi incomplet du jeu) : celle dont le score a bougé */
  if (clip.team < 0) clip.team = cur[1] > b[1] ? 1 : 0;
  /* score juste après CE but : celui du moment du but, +1 pour l'équipe s'il n'était pas encore compté
     (un autre but marqué entre-temps ne fausse pas le clip), jamais en dessous du clip précédent */
  const s = [b[0], b[1]];
  if (cur[clip.team] > b[clip.team]) s[clip.team] = b[clip.team] + 1;
  const prev = gcClips[gcClips.indexOf(clip) - 1];
  if (prev && prev.score) { s[0] = Math.max(s[0], prev.score[0]); s[1] = Math.max(s[1], prev.score[1]); if (s[clip.team] <= prev.score[clip.team]) s[clip.team] = prev.score[clip.team] + 1; }
  clip.score = s;
  if (!obs.ready) return gcFail(clip, 'OBS non connecté');
  if (!obs.rb) return gcFail(clip, 'Replay Buffer arrêté dans OBS');
  gcWaiting.push(clip);
  try { await obsReq('SaveReplayBuffer'); }
  catch { gcDrop(gcWaiting, clip); return gcFail(clip, 'OBS n\'a pas pu enregistrer le clip'); }
  /* pas de nouvelles d'OBS : on prend le dernier replay qu'il a enregistré */
  clip.waitT = setTimeout(async () => {
    if (!gcDrop(gcWaiting, clip)) return;
    try {
      const r = await obsReq('GetLastReplayBufferReplay');
      if (r.savedReplayPath && !gcClips.some(x => x.src === r.savedReplayPath)) return gcAdopt(clip, r.savedReplayPath);
    } catch {}
    gcFail(clip, 'OBS n\'a pas renvoyé le clip');
  }, 15000);
}
function gcOnSaved(src) {
  const clip = gcWaiting.shift();
  if (!clip) return;                                         // replay enregistré à la main dans OBS : pas pour nous
  clearTimeout(clip.waitT);
  gcAdopt(clip, src);
}
/* fichier d'OBS → goal-clips/ (déplacé, ou copié avec « Garder une copie ») */
async function gcAdopt(clip, src) {
  clip.src = src;
  if (!gcClips.includes(clip)) return;
  let ext = path.extname(String(src || '')).toLowerCase();
  if (!/^\.[a-z0-9]{2,5}$/.test(ext)) ext = '.mp4';
  const dest = path.join(GC_DIR, clip.id + ext);
  try {
    fs.mkdirSync(GC_DIR, { recursive: true });
    if (gcCfg().keep) await fs.promises.copyFile(src, dest);
    else {
      try { await fs.promises.rename(src, dest); }
      catch {                                                 // autre disque, ou fichier encore ouvert par OBS
        await fs.promises.copyFile(src, dest);
        const rm = n => fs.promises.unlink(src).catch(() => { if (n) setTimeout(() => rm(n - 1), 3000); });
        rm(3);
      }
    }
  } catch { return gcFail(clip, 'Fichier du clip introuvable'); }
  if (!gcClips.includes(clip)) { fs.promises.unlink(dest).catch(() => {}); return; }
  clip.file = dest; clip.ext = ext; clip.status = 'ready';
  clip.warn = GC_PLAYABLE.has(ext) ? '' : 'format';
  gcBroadcast();
}

/* ── Enchaînement de fin de match : scores → clips → scores ── */
function gcOnMatchEnd() {
  const c = gcCfg();
  if (!c.enabled) return;
  const ser = gameState.series, wins = Math.ceil((ser.bestOf || 0) / 2);
  const seriesWon = !!ser.bestOf && (ser.blue >= wins || ser.orange >= wins);
  clearTimeout(gcEndT);
  /* l'overlay affiche l'écran de fin 1,2 s après la fin (5,5 s après l'écran de victoire de série) */
  gcEndT = setTimeout(() => gcAutoStart(0), (seriesWon ? 5500 : 1200) + c.scoresSec * 1000);
}
function gcAutoStart(tries) {
  gcEndT = null;
  /* clip encore en cours d'enregistrement : on l'attend un peu · timeout en cours : clips après le timeout */
  if ((gcClips.some(x => x.status === 'pending') && tries < 10) || (toLive && tries < 400)) { gcEndT = setTimeout(() => gcAutoStart(tries + 1), 1000); return; }
  gcStartReel();
}
function gcStartReel() {
  const ready = gcClips.filter(x => x.status === 'ready' && x.warn !== 'unplayable');   // clip que l'overlay n'a pas pu lire : sauté
  if (!ready.length) return false;
  const c = gcCfg(), t = gameState.game.teams;
  clearTimeout(gcReelT);
  gcReel = { id: crypto.randomBytes(4).toString('hex'), t0: Date.now(), clipSec: c.clipSec, clips: ready.map(gcPub), final: [+t[0].score || 0, +t[1].score || 0] };
  gcReelT = setTimeout(() => { gcReel = null; gcReelT = null; gcBroadcast(); }, gcReelMs(ready.length, c.clipSec) + 300);
  gcBroadcast();
  return true;
}
function gcStopReel() {
  clearTimeout(gcReelT); gcReelT = null;
  if (!gcReel) return false;
  gcReel = null; gcBroadcast();
  return true;
}
/* nouveau match : clips du précédent effacés */
function gcNewMatch() {
  clearTimeout(gcEndT); gcEndT = null;
  gcStopReel();
  if (!gcClips.length) return;
  for (const c of gcClips) { clearTimeout(c.waitT); clearTimeout(c.saveT); if (c.file) fs.promises.unlink(c.file).catch(() => {}); }
  gcClips = []; gcWaiting.length = 0;
  gcBroadcast();
}
/* réglages appliqués : connexion à OBS ouverte / refaite / fermée */
async function gcApply() {
  const c = gcCfg();
  if (!c.enabled) {
    clearTimeout(gcEndT); gcEndT = null; gcStopReel();
    if (obs.ready && obs.startedRb) { try { await obsReq('StopReplayBuffer'); } catch {} }   // seulement s'il a été lancé par l'app
    obs.startedRb = false;
    obsDisconnect(); obsStatus('off');
    return;
  }
  if (obs.ws && obs.sig !== `${c.port}|${c.password}`) obsDisconnect();   // port ou mot de passe changé
  if (!obs.ws) obsConnect();
}

app.get('/api/goal-clips', (req, res) => res.json(gcState()));
/* { enabled, port, password, scoresSec, clipSec, keep } réglages · { reconnect } nouvelle tentative de connexion à OBS
   { play } passe les clips maintenant · { stop } arrête les clips · { clear } efface les clips du match
   { playError: id } l'overlay n'arrive pas à lire ce clip (format) */
app.post('/api/goal-clips', async (req, res) => {
  const b = req.body || {}, g = gcCfg();
  if (b.port !== undefined) { const p = Number(b.port); if (!Number.isInteger(p) || p < 1 || p > 65535) return res.status(400).json({ error: 'Port invalide', goalClips: gcState() }); g.port = p; }
  if (b.password !== undefined) g.password = String(b.password ?? '').slice(0, 200);
  if (b.scoresSec !== undefined) { if (!GC_SCORES.includes(+b.scoresSec)) return res.status(400).json({ error: 'Durée invalide', goalClips: gcState() }); g.scoresSec = +b.scoresSec; }
  if (b.clipSec !== undefined) { if (!GC_CLIPS.includes(+b.clipSec)) return res.status(400).json({ error: 'Durée invalide', goalClips: gcState() }); g.clipSec = +b.clipSec; }
  if (b.keep !== undefined) g.keep = !!b.keep;
  if (b.enabled !== undefined) g.enabled = !!b.enabled;
  settings.goalClips = g; saveSettings();
  if (b.reconnect && g.enabled) { obsDisconnect(); obs.status = 'connecting'; }
  await gcApply();
  if (b.playError) { const c = gcClips.find(x => x.id === b.playError); if (c && c.warn !== 'unplayable') { c.warn = 'unplayable'; } }
  if (b.stop) gcStopReel();
  if (b.clear) gcNewMatch();
  if (b.play && !gcStartReel()) { gcBroadcast(); return res.status(400).json({ error: 'Aucun clip prêt pour le moment', goalClips: gcState() }); }
  gcBroadcast();
  res.json({ ok: true, goalClips: gcState() });
});
/* fichier d'un clip (lecture par l'overlay, avec avance / retour rapide) */
app.get('/goal-clips/:file', (req, res) => {
  const m = /^([a-f0-9]{16})(\.[a-z0-9]{2,5})$/.exec(req.params.file || '');
  const clip = m && gcClips.find(c => c.id === m[1] && c.ext === m[2] && c.status === 'ready');
  if (!clip) return res.status(404).end();
  res.sendFile(clip.file, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }, err => { if (err && !res.headersSent) res.status(404).end(); });
});
gcApply();

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
  gameTeamNames = ['', ''];
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

/* Nettoyage des thèmes supprimés (voir REMOVED_THEMES) :
   - leur dossier (laissé par une mise à jour, qui ajoute sans supprimer, ou téléchargé depuis le site) est
     retiré — seulement si c'est bien le thème RSCast : dossier ne contenant que le CSS d'origine, ou thème
     identifié comme tel dans son meta.json (alias / id du site). Un thème perso du même nom n'est pas touché ;
   - les thèmes installés et projets du Studio « basés sur » eux perdent ce lien (base → aucune / Default). */
function cleanRemovedThemes() {
  let dirs = [];
  try { dirs = fs.readdirSync(THEMES_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch {}
  for (const d of dirs) {
    const dir = path.join(THEMES_DIR, d);
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch {}
    const ours = REMOVED_THEMES.has(meta.siteId) || [].concat(meta.alias || []).some(a => REMOVED_THEMES.has(a));
    let onlyCss = false;
    try { onlyCss = fs.readdirSync(dir).every(f => f === 'theme.css'); } catch {}
    if (ours || (REMOVED_THEMES.has(d) && onlyCss)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[Thèmes] suppression de', d, ':', e.message); }
      if (settings.theme === d) { settings.theme = 'rlcs'; currentTheme = 'rlcs'; }
      delete settings.themeNames[d];
      continue;
    }
    for (const [file, key] of [['meta.json', 'basedOn'], ['studio.json', 'base']]) {
      const f = path.join(dir, file);
      try {
        const j = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (j && REMOVED_THEMES.has(j[key])) { if (key === 'base') j[key] = 'rlcs'; else delete j[key]; fs.writeFileSync(f, JSON.stringify(j, null, 2)); }
      } catch {}
    }
  }
  saveSettings();
}
cleanRemovedThemes();

function listThemes() {
  const builtin = ['rlcs'];
  try {
    const dirs = fs.readdirSync(THEMES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(THEMES_DIR, d.name, 'theme.css')))
      .map(d => d.name);
    return [...new Set([...builtin, ...dirs])];
  } catch { return builtin; }
}

/* Noms affichés des thèmes : celui choisi dans le panneau, sinon le nom du site retenu au téléchargement
   (meta.json « siteName »), sinon rien (le panneau affiche le nom du dossier) */
function themeDisplayNames() {
  const out = {};
  for (const id of listThemes()) {
    try { const n = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, id, 'meta.json'), 'utf8')).siteName; if (n) out[id] = String(n); } catch {}
  }
  return { ...out, ...settings.themeNames };
}

app.get('/api/themes', (req, res) => {
  res.json({ themes: listThemes(), current: currentTheme, names: themeDisplayNames() });
});

/* Bibliothèque du panneau de contrôle : thèmes custom publics du site (aperçu, code) avec leur
   état local — « local » = dossier du thème déjà installé (repéré par le siteId de son meta.json). */
app.get('/api/site-themes', async (req, res) => {
  const SITE = 'https://overlay.rscast.fr';
  try {
    const r = await fetch(`${SITE}/api/themes`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const list = await r.json();
    const local = {};
    for (const name of listThemes()) {
      try {
        const id = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, name, 'meta.json'), 'utf8')).siteId;
        if (id && !local[id]) local[id] = name;
      } catch {}
    }
    const themes = (Array.isArray(list) ? list : [])
      .filter(t => !t.builtin && t.shareId && !t.private && (!t.status || t.status === 'approved'))
      .map(t => ({
        id: t.id, name: t.name, description: t.description || '', code: t.shareId,
        image: t.imageUrl ? new URL(t.imageUrl, SITE).href : null,
        local: local[t.id] || null,
      }));
    res.json({ ok: true, themes, current: currentTheme });
  } catch {
    res.status(502).json({ error: 'Impossible de joindre le site — vérifie ta connexion' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   STUDIO DE THÈMES (public/studio.html)
   Les fichiers ajoutés dans le Studio (images, vidéos, polices, Lottie) sont rangés dans
   studio-work/ sous leur empreinte SHA-1 : l'aperçu les charge par URL, et l'installation
   les copie dans le dossier du thème. Le CSS et le meta.json sont générés par le Studio
   avec le jeton __THEME__ à la place du nom du dossier, remplacé ici.
══════════════════════════════════════════════════════════════════ */
/* STUDIO_WORK_DIR : autre dossier de travail (tests automatiques, sans toucher aux fichiers de l'utilisateur) */
const STUDIO_WORK = process.env.STUDIO_WORK_DIR || path.join(__dirname, 'studio-work');
fs.mkdirSync(STUDIO_WORK, { recursive: true });
app.use('/studio-work', express.static(STUDIO_WORK, { maxAge: '7d' }));

const STUDIO_ASSET_EXT = /^(png|jpe?g|webp|gif|svg|webm|mp4|mov|json|ttf|otf|woff2?|mp3|wav|ogg)$/i;
const STUDIO_ASSET_NAME = /^[a-f0-9]{20}\.[a-z0-9]{2,5}$/;
const THEME_FILE_EXT = /\.(css|json|png|jpe?g|webp|gif|svg|ico|webm|mp4|mov|mp3|wav|ogg|ttf|otf|woff2?)$/i;

app.post('/api/studio/asset', express.raw({ type: () => true, limit: '400mb' }), (req, res) => {
  const name = decodeURIComponent(String(req.get('x-file-name') || 'fichier'));
  let ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!STUDIO_ASSET_EXT.test(ext)) return res.status(400).json({ error: 'Type de fichier non pris en charge' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Fichier vide' });
  const id = require('crypto').createHash('sha1').update(req.body).digest('hex').slice(0, 20);
  const file = `${id}.${ext}`;
  const dest = path.join(STUDIO_WORK, file);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, req.body);
  res.json({ ok: true, id, file, url: `/studio-work/${file}`, size: req.body.length });
});

/* Sauvegarde automatique du Studio sur le disque (projet en cours + fichier .rlstudio ouvert) :
   le Studio la reprend à chaque ouverture, même si le stockage du navigateur a été vidé. */
const STUDIO_AUTOSAVE = path.join(STUDIO_WORK, 'autosave.json');
app.get('/api/studio/autosave', (req, res) => {
  try { res.type('json').send(fs.readFileSync(STUDIO_AUTOSAVE, 'utf8')); }
  catch { res.json(null); }
});
app.post('/api/studio/autosave', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.project || b.project.format !== 'rlo-studio') return res.status(400).json({ error: 'Projet invalide' });
    /* un autre projet remplace la sauvegarde auto : l'ancien part dans les versions de secours */
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(STUDIO_AUTOSAVE, 'utf8')); } catch {}
    if (prev && prev.project && prev.project.id !== b.project.id) saveStudioVersion(prev, 'replaced');
    const entry = { project: b.project, file: b.file || null, dirty: !!b.dirty, at: Date.now() };
    const tmp = STUDIO_AUTOSAVE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(entry));
    fs.renameSync(tmp, STUDIO_AUTOSAVE);
    /* une version toutes les 5 min de travail sur un même projet */
    const last = listStudioVersions().find(v => v.projectId === String(b.project.id || ''));
    if (!last || Date.now() - last.at >= STUDIO_VERSION_EVERY) saveStudioVersion(entry, 'auto');
    if (entry.file) addStudioRecent(entry.file, b.project.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Versions de secours : instantanés du projet (10 par projet, 60 en tout) ── */
const STUDIO_VERSIONS = path.join(STUDIO_WORK, 'versions');
const STUDIO_VERSION_EVERY = 5 * 60 * 1000;
const VERSION_FILE = /^(\d{13})-([a-zA-Z0-9]{0,40})\.json$/;
function listStudioVersions() {
  let names = [];
  try { names = fs.readdirSync(STUDIO_VERSIONS); } catch {}
  return names.map(f => { const m = f.match(VERSION_FILE); return m ? { vid: f, at: +m[1], projectId: m[2] } : null; })
    .filter(Boolean).sort((a, b) => b.at - a.at);
}
function saveStudioVersion(entry, reason) {
  try {
    const p = entry && entry.project;
    if (!p || p.format !== 'rlo-studio') return;
    fs.mkdirSync(STUDIO_VERSIONS, { recursive: true });
    const pid = String(p.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
    let at = Date.now();
    while (fs.existsSync(path.join(STUDIO_VERSIONS, `${at}-${pid}.json`))) at++;
    fs.writeFileSync(path.join(STUDIO_VERSIONS, `${at}-${pid}.json`), JSON.stringify({ project: p, file: entry.file || null, at, reason }));
    /* ménage : 10 versions par projet, 60 au total */
    const perProject = {};
    listStudioVersions().forEach((v, i) => {
      perProject[v.projectId] = (perProject[v.projectId] || 0) + 1;
      if (perProject[v.projectId] > 10 || i >= 60) fs.rmSync(path.join(STUDIO_VERSIONS, v.vid), { force: true });
    });
  } catch (e) { console.warn('[Studio] version de secours impossible :', e.message); }
}
app.get('/api/studio/versions', (req, res) => {
  const out = [];
  for (const v of listStudioVersions()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(STUDIO_VERSIONS, v.vid), 'utf8'));
      const p = j.project || {};
      out.push({ vid: v.vid, at: v.at, projectId: v.projectId, name: p.name || 'Sans nom', layers: (p.layers || []).filter(L => L.type !== 'group').length, file: j.file || null, reason: j.reason || 'auto' });
    } catch {}
  }
  res.json({ ok: true, versions: out });
});
app.get('/api/studio/versions/:vid', (req, res) => {
  const vid = String(req.params.vid);
  if (!VERSION_FILE.test(vid)) return res.status(400).json({ error: 'Version invalide' });
  try { res.json({ ok: true, ...JSON.parse(fs.readFileSync(path.join(STUDIO_VERSIONS, vid), 'utf8')) }); }
  catch { res.status(404).json({ error: 'Version introuvable' }); }
});
/* instantané immédiat (ex. avant de restaurer une autre version) */
app.post('/api/studio/versions', (req, res) => {
  const b = req.body || {};
  if (!b.project || b.project.format !== 'rlo-studio') return res.status(400).json({ error: 'Projet invalide' });
  saveStudioVersion({ project: b.project, file: b.file || null }, b.reason === 'restore' ? 'restore' : 'manual');
  res.json({ ok: true });
});

/* ── Projets récents : fichiers .rlstudio ouverts ou enregistrés (10 derniers) ── */
const STUDIO_RECENT = path.join(STUDIO_WORK, 'recent.json');
function readStudioRecent() { try { const r = JSON.parse(fs.readFileSync(STUDIO_RECENT, 'utf8')); return Array.isArray(r) ? r : []; } catch { return []; } }
function addStudioRecent(file, name) {
  const list = readStudioRecent().filter(r => r.file !== file);
  list.unshift({ file, name: String(name || '').slice(0, 60), at: Date.now() });
  try { fs.writeFileSync(STUDIO_RECENT, JSON.stringify(list.slice(0, 10))); } catch {}
}
app.get('/api/studio/recent', (req, res) => {
  res.json({ ok: true, recent: readStudioRecent().map(r => ({ ...r, exists: fs.existsSync(r.file) })) });
});
app.post('/api/studio/recent/remove', (req, res) => {
  const file = String(req.body?.file || '');
  try { fs.writeFileSync(STUDIO_RECENT, JSON.stringify(readStudioRecent().filter(r => r.file !== file))); } catch {}
  res.json({ ok: true });
});

/* ── Nettoyage de studio-work : fichiers importés que plus aucun projet n'utilise. Gardés : ceux de la
   sauvegarde auto, des versions de secours et ceux envoyés par le Studio (projet ouvert + historique
   annuler/rétablir). Les thèmes installés et les .rlstudio ont leur propre copie des fichiers. ── */
const ASSET_REF = /[a-f0-9]{20}\.[a-z0-9]{2,5}/g;
app.post('/api/studio/cleanup', (req, res) => {
  const keep = new Set((Array.isArray(req.body?.keep) ? req.body.keep : []).map(String));
  const scan = f => { try { for (const m of fs.readFileSync(f, 'utf8').match(ASSET_REF) || []) keep.add(m); } catch {} };
  scan(STUDIO_AUTOSAVE);
  for (const v of listStudioVersions()) scan(path.join(STUDIO_VERSIONS, v.vid));
  let count = 0, bytes = 0;
  for (const f of fs.readdirSync(STUDIO_WORK)) {
    if (!STUDIO_ASSET_NAME.test(f) || keep.has(f)) continue;
    const p = path.join(STUDIO_WORK, f);
    let size = 0;
    try { size = fs.statSync(p).size; } catch { continue; }
    if (!req.body?.dry) { try { fs.rmSync(p, { force: true }); } catch { continue; } }
    count++; bytes += size;
  }
  res.json({ ok: true, count, bytes, kept: [...keep].filter(f => STUDIO_ASSET_NAME.test(f) && fs.existsSync(path.join(STUDIO_WORK, f))).length, dry: !!req.body?.dry });
});

/* Thèmes installés (pour « Basé sur » et « Ouvrir un thème du Studio ») */
app.get('/api/studio/themes', (req, res) => {
  const themes = listThemes().map(id => {
    let studio = null, meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, id, 'meta.json'), 'utf8')); } catch {}
    try { studio = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, id, 'studio.json'), 'utf8')); } catch {}
    return { id, label: settings.themeNames[id] || meta.siteName || null, studio: !!studio, name: studio?.name || null, basedOn: meta.basedOn || null };
  });
  /* renamed : le Studio convertit la base des projets enregistrés avant un renommage de thème */
  res.json({ ok: true, themes, current: currentTheme, removed: [...REMOVED_THEMES] });
});

/* Rouvre un thème créé avec le Studio : son projet (studio.json) + ses fichiers remis dans studio-work */
app.get('/api/studio/project/:id', (req, res) => {
  const id = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = path.join(THEMES_DIR, id);
  let project;
  try { project = JSON.parse(fs.readFileSync(path.join(dir, 'studio.json'), 'utf8')); }
  catch { return res.status(404).json({ error: "Ce thème n'a pas été créé avec le Studio" }); }
  for (const a of Object.values(project.assets || {})) {
    const f = String(a.file || '');
    if (!STUDIO_ASSET_NAME.test(f)) continue;
    const src = path.join(dir, f), dst = path.join(STUDIO_WORK, f);
    if (!fs.existsSync(dst) && fs.existsSync(src)) fs.copyFileSync(src, dst);
  }
  project.themeId = id;
  res.json({ ok: true, project });
});

/* ZIP minimal (deflate) pour l'export du thème */
const _crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const zlib = require('zlib');
  const locals = [], centrals = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const raw = f.data;
    /* f.store : déjà compressé (vidéos, images) → rangé tel quel, sans recompresser pour rien */
    const comp = f.store ? null : zlib.deflateRawSync(raw);
    const useDeflate = !!comp && comp.length < raw.length;
    const data = useDeflate ? comp : raw;
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(useDeflate ? 8 : 0, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(useDeflate ? 8 : 0, 10); ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, data);
    centrals.push(ch, name);
    offset += lh.length + name.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* Construit les fichiers du thème : base (fichiers du thème d'origine), CSS/meta/projet générés, fichiers du Studio */
function studioThemeFiles(b, id) {
  const files = new Map();
  const base = String(b.base || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const baseDir = base && base !== 'rlcs' ? path.join(THEMES_DIR, base) : null;
  if (baseDir && fs.existsSync(baseDir)) {
    for (const f of fs.readdirSync(baseDir)) {
      if (['theme.css', 'meta.json', 'studio.json'].includes(f) || !THEME_FILE_EXT.test(f)) continue;
      const p = path.join(baseDir, f);
      if (fs.statSync(p).isFile()) files.set(f, fs.readFileSync(p));
    }
  }
  for (const f of Array.isArray(b.assets) ? b.assets : []) {
    if (!STUDIO_ASSET_NAME.test(f)) continue;
    const p = path.join(STUDIO_WORK, f);
    if (fs.existsSync(p)) files.set(f, fs.readFileSync(p));
  }
  const fill = s => String(s || '').split('__THEME__').join(id);
  const meta = b.meta && typeof b.meta === 'object' ? b.meta : {};
  const project = b.project && typeof b.project === 'object' ? { ...b.project, themeId: id } : null;
  files.set('theme.css', Buffer.from(fill(b.css), 'utf8'));
  files.set('meta.json', Buffer.from(JSON.stringify(meta, null, 2), 'utf8'));
  if (project) files.set('studio.json', Buffer.from(JSON.stringify(project), 'utf8'));
  return files;
}

const studioSlug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

app.post('/api/studio/build', (req, res) => {
  const b = req.body || {};
  if (!b.css) return res.status(400).json({ error: 'Projet vide' });
  let wanted = studioSlug(b.themeId || b.name) || 'mon-theme';
  if (wanted === 'rlcs' || wanted === 'rlo-studio') wanted += '-studio';

  if (b.mode === 'zip') {
    const files = studioThemeFiles(b, wanted);
    const zip = makeZip([...files].map(([name, data]) => ({ name, data })));
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${wanted}.zip"`);
    return res.send(zip);
  }

  /* Dossier : celui du même projet s'il est déjà installé, sinon le premier nom libre
     (jamais celui d'un autre thème) */
  const projectId = String(b.project?.id || '');
  let id = wanted, updated = false;
  for (let n = 1; ; n++) {
    const cand = n === 1 ? wanted : `${wanted}-${n}`;
    const dir = path.join(THEMES_DIR, cand);
    if (!fs.existsSync(dir)) { id = cand; break; }
    let sid = null;
    try { sid = JSON.parse(fs.readFileSync(path.join(dir, 'studio.json'), 'utf8')).id; } catch {}
    if (projectId && sid === projectId) { id = cand; updated = true; break; }
  }
  const files = studioThemeFiles(b, id);
  const dir = path.join(THEMES_DIR, id);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rl-studio-'));
  try {
    for (const [name, data] of files) fs.writeFileSync(path.join(tmp, name), data);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(tmp, dir, { recursive: true });
  } catch (e) {
    return res.status(500).json({ error: 'Écriture du thème impossible : ' + e.message });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const label = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (label) settings.themeNames[id] = label;
  if (b.apply) { currentTheme = id; settings.theme = id; }
  saveSettings();
  broadcast('themes_changed', { id });
  if (b.apply) broadcast('theme_change', { theme: id });
  res.json({ ok: true, id, updated, applied: !!b.apply });
});

/* Fichiers d'un ZIP (à plat, par nom de fichier ; dossiers et fichiers système macOS ignorés) */
function readZipFiles(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(new Error("Ce fichier n'est pas un ZIP valide"));
      const files = {};
      zipfile.readEntry();
      zipfile.on('entry', entry => {
        const base = path.basename(entry.fileName);
        if (/\/$/.test(entry.fileName) || /(^|\/)__MACOSX\//.test(entry.fileName) || base.startsWith('._') || !THEME_FILE_EXT.test(base)) { zipfile.readEntry(); return; }
        zipfile.openReadStream(entry, (e, rs) => {
          if (e) { zipfile.readEntry(); return; }
          const chunks = [];
          rs.on('data', c => chunks.push(c));
          rs.on('end', () => { files[base] = Buffer.concat(chunks); zipfile.readEntry(); });
          rs.on('error', () => zipfile.readEntry());
        });
      });
      zipfile.on('end', () => resolve(files));
      zipfile.on('error', () => reject(new Error('ZIP illisible')));
    });
  });
}

/* Import d'un thème .zip dans le Studio :
   - ZIP exporté par le Studio (studio.json) → son projet complet, fichiers remis dans studio-work ;
   - autre thème (theme.css + images…) → installé comme un thème normal, pour servir de « Basé sur »
     à un nouveau projet. Réimporter le même ZIP réutilise le thème déjà installé (pas de doublon). */
app.post('/api/studio/import-zip', upload.single('zip'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  const r = await importStudioZip(req.file.buffer, req.body.filename);
  res.status(r.status || 200).json(r.body);
});
async function importStudioZip(buffer, filename) {
  const fail = (status, error) => ({ status, body: { error } });
  const ok = body => ({ status: 200, body: { ok: true, ...body } });
  let files;
  try { files = await readZipFiles(buffer); }
  catch (e) { return fail(400, e.message); }

  let project = null;
  try { const p = JSON.parse(files['studio.json'].toString('utf8')); if (p && p.format === 'rlo-studio') project = p; } catch {}
  if (project) {
    let missing = 0;
    for (const a of Object.values(project.assets || {})) {
      const f = String(a.file || '');
      if (!STUDIO_ASSET_NAME.test(f)) continue;
      const dst = path.join(STUDIO_WORK, f);
      if (fs.existsSync(dst)) continue;
      if (files[f]) fs.writeFileSync(dst, files[f]); else missing++;
    }
    const base = String(project.base || 'rlcs');
    const missingBase = base !== 'rlcs' && !listThemes().includes(base) ? base : null;
    return ok({ kind: 'project', project, missing, missingBase });
  }

  if (!files['theme.css']) return fail(400, "Ce ZIP ne contient pas de thème (theme.css manquant)");
  let stem = studioSlug(String(filename || '').replace(/\.zip$/i, '')) || 'theme-importe';
  if (['rlcs', 'rlo-studio', '__theme__'].includes(stem)) stem += '-importe';
  const exists = id => fs.existsSync(path.join(THEMES_DIR, id));
  let id = stem;
  for (let n = 2; exists(id); n++) id = `${stem}-${n}`;
  const dir = path.join(THEMES_DIR, id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    await extractThemeZip(buffer, dir, id, null);
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    return fail(400, e.message || 'Extraction du ZIP impossible');
  }
  /* même ZIP déjà importé (même CSS au nom du dossier près, mêmes fichiers) : on garde l'existant */
  const sig = (d, name) => {
    try {
      const css = fs.readFileSync(path.join(THEMES_DIR, d, 'theme.css'), 'utf8').split(name).join('\u0000');
      const list = fs.readdirSync(path.join(THEMES_DIR, d)).filter(f => f !== 'theme.css' && f !== 'meta.json')
        .map(f => f + ':' + fs.statSync(path.join(THEMES_DIR, d, f)).size).sort().join('|');
      return css + '\n' + list;
    } catch { return null; }
  };
  const mine = sig(id, id);
  for (let n = 1; ; n++) {
    const cand = n === 1 ? stem : `${stem}-${n}`;
    if (cand === id) break;
    if (!exists(cand)) continue;
    if (sig(cand, cand) === mine) {
      fs.rmSync(dir, { recursive: true, force: true });
      return ok({ kind: 'theme', id: cand, reused: true });
    }
  }
  broadcast('themes_changed', { id });
  return ok({ kind: 'theme', id, reused: false });
}

/* ── Partage d'un projet par code, via le compte du site (licence de la session de l'app) ──
   Le projet part en ZIP du Studio (thème + studio.json + fichiers) ; le site rend un code court
   valable 30 jours. Récupérer un code ne demande pas de compte. */
const STUDIO_SITE = process.env.STUDIO_SITE_URL || 'https://overlay.rscast.fr';
const siteJson = async r => { const j = await r.json().catch(() => ({})); return { status: r.status, body: r.ok ? j : { error: j.error || `Le site a répondu ${r.status}` } }; };
const siteDown = e => ({ status: 502, body: { error: 'Site injoignable : ' + (e.name === 'TimeoutError' ? 'délai dépassé' : e.message) } });
const noLicense = res => res.status(401).json({ error: "Connecte-toi à ton compte RL Overlay dans l'app pour partager" });
app.post('/api/studio/share', async (req, res) => {
  if (!_session?.license) return noLicense(res);
  const b = req.body || {};
  if (!b.css || !b.project) return res.status(400).json({ error: 'Projet vide' });
  let wanted = studioSlug(b.themeId || b.name) || 'mon-theme';
  if (wanted === 'rlcs' || wanted === 'rlo-studio') wanted += '-studio';
  const zip = makeZip([...studioThemeFiles(b, wanted)].map(([name, data]) => ({ name, data })));
  try {
    const fd = new FormData();
    fd.append('license', _session.license);
    fd.append('name', String(b.name || 'Projet'));
    fd.append('zip', new Blob([zip], { type: 'application/zip' }), `${wanted}.zip`);
    const r = await siteJson(await fetch(`${STUDIO_SITE}/api/studio-shares`, { method: 'POST', body: fd, signal: AbortSignal.timeout(180000) }));
    res.status(r.status).json(r.body);
  } catch (e) { const r = siteDown(e); res.status(r.status).json(r.body); }
});
app.get('/api/studio/shares', async (req, res) => {
  if (!_session?.license) return noLicense(res);
  try { const r = await siteJson(await fetch(`${STUDIO_SITE}/api/studio-shares/mine?license=${encodeURIComponent(_session.license)}`, { signal: AbortSignal.timeout(15000) })); res.status(r.status).json(r.body); }
  catch (e) { const r = siteDown(e); res.status(r.status).json(r.body); }
});
app.delete('/api/studio/shares/:code', async (req, res) => {
  if (!_session?.license) return noLicense(res);
  const code = String(req.params.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  try { const r = await siteJson(await fetch(`${STUDIO_SITE}/api/studio-shares/${code}?license=${encodeURIComponent(_session.license)}`, { method: 'DELETE', signal: AbortSignal.timeout(15000) })); res.status(r.status).json(r.body); }
  catch (e) { const r = siteDown(e); res.status(r.status).json(r.body); }
});
/* Ouvrir un projet partagé : code → ZIP téléchargé depuis le site → même import qu'un .zip */
app.post('/api/studio/share-import', async (req, res) => {
  const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (code.length < 4) return res.status(400).json({ error: 'Code invalide' });
  try {
    const info = await siteJson(await fetch(`${STUDIO_SITE}/api/studio-shares/${code}`, { signal: AbortSignal.timeout(15000) }));
    if (info.status !== 200) return res.status(info.status === 404 ? 404 : info.status).json(info.body);
    const r = await fetch(`${STUDIO_SITE}/download/studio-share/${code}`, { signal: AbortSignal.timeout(300000) });
    if (!r.ok) return res.status(r.status).json({ error: 'Téléchargement impossible' });
    const out = await importStudioZip(Buffer.from(await r.arrayBuffer()), `${info.body.share.name}.zip`);
    if (out.body.ok) out.body.share = info.body.share;
    res.status(out.status).json(out.body);
  } catch (e) { const r = siteDown(e); res.status(r.status).json(r.body); }
});

/* Image PNG 1920×1080 de l'overlay (rendu hors écran par Electron) */
app.post('/api/studio/snapshot', async (req, res) => {
  let electron = null;
  try { electron = require('electron'); } catch {}
  if (!electron || typeof electron !== 'object' || !electron.BrowserWindow) {
    return res.status(501).json({ error: "L'export en image n'est disponible que dans l'application" });
  }
  const transparent = req.body?.bg === 'transparent';
  /* enableLargerThanScreen : sinon Windows rogne la fenêtre à la zone de travail de l'écran
     (1920×1032 avec la barre des tâches) ; zoom forcé à 1 malgré la mise à l'échelle de Windows */
  const win = new electron.BrowserWindow({
    width: 1920, height: 1080, useContentSize: true, show: false, frame: false, enableLargerThanScreen: true,
    transparent, backgroundColor: transparent ? '#00000000' : '#09090f',
    webPreferences: { offscreen: true, backgroundThrottling: false, zoomFactor: 1 },
  });
  try {
    win.setContentSize(1920, 1080);
    win.webContents.setFrameRate(30);
    await win.loadURL(`http://127.0.0.1:${PORT}/global.html?preview&studio=render`);
    win.webContents.setZoomFactor(1);
    await win.webContents.executeJavaScript(`window.__studio.render(${JSON.stringify(req.body || {})})`, true);
    let img = await win.webContents.capturePage();
    const sz = img.getSize();
    if (sz.width !== 1920 || sz.height !== 1080) img = img.resize({ width: 1920, height: 1080, quality: 'best' });
    res.type('png').send(img.toPNG());
  } catch (e) {
    res.status(500).json({ error: 'Rendu impossible : ' + e.message });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
});

/* Renomme un thème dans le panneau : seul le nom affiché change (le dossier, les sélecteurs
   [data-theme] du CSS et les liens des sources OBS restent identiques). Nom vide = nom d'origine. */
app.post('/api/themes/:name/label', (req, res) => {
  const name = req.params.name;
  if (!listThemes().includes(name)) return res.status(404).json({ error: 'thème introuvable' });
  const label = String(req.body?.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (label) settings.themeNames[name] = label;
  else delete settings.themeNames[name];
  saveSettings();
  res.json({ ok: true, names: themeDisplayNames() });
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
  // basedOn : priorité au champ explicite du formulaire, sinon auto-détection (valeur la plus fréquente)
  const forcedBase = (req.body.basedOn || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  let basedOn;
  if (forcedBase) {
    basedOn = forcedBase;
  } else {
    const allThemeRefs = [...css.matchAll(/\[data-theme="([^"]+)"\]/g)].map(m => m[1]);
    const freq = {};
    allThemeRefs.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    basedOn = allThemeRefs.length > 0
      ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
      : null;
  }
  // Réécrire les sélecteurs avec le nouveau nom
  css = css.replace(/\[data-theme="[^"]*"\]/g, `[data-theme="${name}"]`);
  fs.writeFileSync(path.join(themeDir, 'theme.css'), css);
  // Sauver les métadonnées (thème d'origine pour les comportements JS)
  if (REMOVED_THEMES.has(basedOn)) basedOn = null;   // basé sur un thème supprimé : plus de lien
  if (basedOn && basedOn !== name) {
    fs.writeFileSync(path.join(themeDir, 'meta.json'), JSON.stringify({ basedOn }, null, 2));
  }
  res.json({ ok: true, name, basedOn });
});

/* ── Import ZIP de thème (CSS + meta.json + images) ── */
function extractThemeZip(buffer, themeDir, name, forcedBasedOn) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      const ALLOWED = /\.(css|json|png|jpe?g|webp|gif|svg|ico|webm|mp4|mov|mp3|wav|ogg|ttf|otf|woff2?)$/i;
      const files = {}; // basename → Buffer

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) { zipfile.readEntry(); return; } // dossier
        const basename = path.basename(entry.fileName);
        if (!ALLOWED.test(basename)) { zipfile.readEntry(); return; }     // extension non autorisée
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) { zipfile.readEntry(); return; }
          const chunks = [];
          readStream.on('data', c => chunks.push(c));
          readStream.on('end', () => { files[basename] = Buffer.concat(chunks); zipfile.readEntry(); });
          readStream.on('error', () => zipfile.readEntry());
        });
      });

      zipfile.on('end', () => {
        if (!files['theme.css']) return reject(new Error('theme.css manquant dans le ZIP'));

        // Détecter basedOn depuis les sélecteurs CSS
        let css = files['theme.css'].toString('utf8');
        let basedOn = null;
        if (!forcedBasedOn) {
          const refs = [...css.matchAll(/\[data-theme="([^"]+)"\]/g)].map(m => m[1]);
          const freq = {};
          refs.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
          basedOn = refs.length ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : null;
        }

        // meta.json du ZIP peut préciser/corriger basedOn, déclarer un "alias"
        // (identité d'origine du thème, ex: "rs-cup") à conserver après renommage,
        // et des vidéos replay/live propres au thème ("wipeVideos")
        let alias = null;
        let wipeVideos = null;
        let originalMeta = null;
        if (files['meta.json']) {
          try {
            const m = JSON.parse(files['meta.json'].toString('utf8'));
            originalMeta = m;
            if (!forcedBasedOn && m.basedOn) basedOn = m.basedOn;
            if (m.alias) alias = m.alias;
            if (m.wipeVideos && typeof m.wipeVideos === 'object') wipeVideos = m.wipeVideos;
          } catch {}
        }

        /* thème basé sur un thème supprimé : plus de lien */
        const finalBasedOn = REMOVED_THEMES.has(forcedBasedOn || basedOn) ? null : (forcedBasedOn || basedOn || null);

        // Détecter le nom original du thème (avant réécriture) pour corriger les chemins d'images
        const originalRefs = [...css.matchAll(/\[data-theme="([^"]+)"\]/g)].map(m => m[1]);
        const origFreq = {};
        originalRefs.forEach(t => { origFreq[t] = (origFreq[t] || 0) + 1; });
        const originalName = originalRefs.length
          ? Object.entries(origFreq).sort((a, b) => b[1] - a[1])[0][0]
          : null;

        // Réécrire les sélecteurs data-theme
        css = css.replace(/\[data-theme="[^"]*"\]/g, `[data-theme="${name}"]`);

        // Réécrire les chemins d'images url('/themes/original/...') → url('/themes/name/...')
        if (originalName && originalName !== name) {
          const escapedOrig = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          css = css.replace(new RegExp(`(/themes/)${escapedOrig}(/)`, 'g'), `$1${name}$2`);
        }

        fs.writeFileSync(path.join(themeDir, 'theme.css'), css);

        // Écrire meta.json : on repart du meta.json d'origine (préserve tout champ que cette
        // fonction ne connaît pas explicitement, ex: "endBackground") et on ne réécrit que
        // basedOn/alias/wipeVideos, dont la valeur finale peut différer de celle du fichier
        // source (détection depuis le CSS, forcedBasedOn) — avant, meta.json était reconstruit
        // de zéro avec seulement ces 3 champs, ce qui effaçait silencieusement tout le reste.
        const metaOut = { ...(originalMeta || {}) };
        delete metaOut.basedOn; delete metaOut.alias; delete metaOut.wipeVideos;
        if (finalBasedOn && finalBasedOn !== name) metaOut.basedOn = finalBasedOn;
        if (alias) metaOut.alias = alias;
        if (wipeVideos) metaOut.wipeVideos = wipeVideos;
        if (Object.keys(metaOut).length)
          fs.writeFileSync(path.join(themeDir, 'meta.json'), JSON.stringify(metaOut, null, 2));

        // Écrire les images et autres fichiers
        for (const [fname, content] of Object.entries(files)) {
          if (fname === 'theme.css' || fname === 'meta.json') continue;
          fs.writeFileSync(path.join(themeDir, fname), content);
        }

        resolve({ basedOn: finalBasedOn });
      });

      zipfile.on('error', reject);
    });
  });
}

/* Lecture rapide du meta.json dans un ZIP (pour auto-remplir le formulaire) */
app.post('/api/themes/zip-peek', upload.single('zip'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  yauzl.fromBuffer(req.file.buffer, { lazyEntries: true }, (err, zipfile) => {
    if (err) return res.status(400).json({ error: 'ZIP invalide' });
    let answered = false;
    const done = (data) => { if (!answered) { answered = true; try { zipfile.close(); } catch {} res.json(data); } };
    zipfile.readEntry();
    zipfile.on('entry', (entry) => {
      if (path.basename(entry.fileName) === 'meta.json') {
        zipfile.openReadStream(entry, (err, stream) => {
          if (err) return done({ ok: true, basedOn: null });
          const chunks = [];
          stream.on('data', c => chunks.push(c));
          stream.on('end', () => {
            try { const m = JSON.parse(Buffer.concat(chunks).toString('utf8')); done({ ok: true, basedOn: m.basedOn || null }); }
            catch  { done({ ok: true, basedOn: null }); }
          });
          stream.on('error', () => done({ ok: true, basedOn: null }));
        });
      } else { zipfile.readEntry(); }
    });
    zipfile.on('end',   () => done({ ok: true, basedOn: null }));
    zipfile.on('error', () => done({ ok: true, basedOn: null }));
  });
});

app.post('/api/themes/import-zip', upload.single('zip'), async (req, res) => {
  const file = req.file;
  const name = (req.body.name || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!file || !name) return res.status(400).json({ error: 'Nom et fichier ZIP requis' });
  const themeDir = path.join(THEMES_DIR, name);
  const forcedBase = (req.body.basedOn || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || null;
  try {
    fs.mkdirSync(themeDir, { recursive: true });
    const { basedOn } = await extractThemeZip(file.buffer, themeDir, name, forcedBase);
    res.json({ ok: true, name, basedOn });
  } catch (e) {
    try { fs.rmSync(themeDir, { recursive: true, force: true }); } catch {}
    res.status(400).json({ error: e.message || 'Erreur extraction ZIP' });
  }
});

/* Télécharge et installe un thème custom depuis le site via son code court —
   progression diffusée en WebSocket ('theme_download_progress') pour la barre
   de progression du panneau de contrôle. */
app.post('/api/themes/download-by-id', async (req, res) => {
  const shareId = String(req.body?.shareId || '').trim().toUpperCase();
  if (!shareId) return res.status(400).json({ error: 'Code requis' });

  broadcast('theme_download_progress', { status: 'resolving', percent: 0 });
  try {
    // Deux systèmes de code côté site : le code court permanent d'un thème public
    // (shareId, /resolve + /download/theme/by-code) et le code temporaire (1h) d'un
    // thème privé (downloadCode, /resolve-private + /download/theme/by-private-code).
    // On essaie d'abord le code permanent, puis on retombe sur le code temporaire.
    let resolved = await getJSON(`https://overlay.rscast.fr/api/themes/resolve/${encodeURIComponent(shareId)}`);
    let downloadUrl = `https://overlay.rscast.fr/download/theme/by-code/${shareId}/zip`;

    if (resolved.status !== 200 || !resolved.body?.ok) {
      const priv = await getJSON(`https://overlay.rscast.fr/api/themes/resolve-private/${encodeURIComponent(shareId)}`);
      if (priv.status === 200 && priv.body?.ok) {
        resolved = priv;
        downloadUrl = `https://overlay.rscast.fr/download/theme/by-private-code/${shareId}/zip`;
      } else if (priv.status === 410) {
        broadcast('theme_download_progress', { status: 'error', error: 'Code expiré' });
        return res.status(410).json({ error: 'Code expiré' });
      } else {
        broadcast('theme_download_progress', { status: 'error', error: 'Code invalide' });
        return res.status(404).json({ error: 'Code invalide' });
      }
    }
    const { id, name } = resolved.body;
    const base = id.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || ('theme' + Date.now());

    /* Dossier local : jamais celui d'un AUTRE thème. Avant, le dossier portait simplement l'id
       du site : un thème du site nommé comme un thème déjà présent (ex. « rbrs ») écrasait ce
       dernier sans rien ajouter à la liste. Le meta.json d'un thème téléchargé retient son id
       du site ("siteId") : le même thème est mis à jour à sa place, sinon on prend le premier
       nom libre (rbrs-2, rbrs-3…). */
    const siteIdOf = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')).siteId || null; } catch { return null; } };
    let localName = base, updated = false;
    for (let n = 1; ; n++) {
      const cand = n === 1 ? base : `${base}-${n}`;
      if (cand === 'rlcs') continue;   // thème intégré sans dossier
      const dir = path.join(THEMES_DIR, cand);
      if (!fs.existsSync(dir)) { localName = cand; break; }
      if (siteIdOf(dir) === id) { localName = cand; updated = true; break; }
    }

    broadcast('theme_download_progress', { status: 'downloading', percent: 0, name });
    const zipBuffer = await downloadWithProgress(
      downloadUrl,
      (percent) => broadcast('theme_download_progress', { status: 'downloading', percent, name })
    );

    broadcast('theme_download_progress', { status: 'extracting', percent: 100, name });
    // Extraction à part puis remplacement du dossier : une mise à jour ne garde pas les fichiers
    // retirés du thème, et un ZIP invalide ne touche pas au thème déjà installé.
    const themeDir = path.join(THEMES_DIR, localName);
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rl-theme-'));
    try {
      await extractThemeZip(zipBuffer, tmpDir, localName, null);
      const metaPath = path.join(tmpDir, 'meta.json');
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
      meta.siteId = id;
      meta.siteName = String(name || '').slice(0, 60) || undefined;   // nom affiché par défaut dans le panneau
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      fs.rmSync(themeDir, { recursive: true, force: true });
      fs.cpSync(tmpDir, themeDir, { recursive: true });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    broadcast('theme_download_progress', { status: 'done', percent: 100, name, id: localName, updated });
    res.json({ ok: true, id: localName, name, updated });
  } catch (e) {
    broadcast('theme_download_progress', { status: 'error', error: e.message || 'Erreur de téléchargement' });
    res.status(500).json({ error: e.message || 'Erreur de téléchargement' });
  }
});

app.delete('/api/themes/:name', (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
  const builtinProtected = ['rlcs'];
  if (builtinProtected.includes(name)) return res.status(403).json({ error: 'thème protégé' });
  const themeDir = path.join(THEMES_DIR, name);
  if (fs.existsSync(themeDir)) fs.rmSync(themeDir, { recursive: true });
  if (settings.themeNames[name]) { delete settings.themeNames[name]; saveSettings(); }
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
    gcOnGoal({ team, scorer: 'Manual', speed: gameState.game.ballSpeed, shown: true });   // test des clips sans match
  }
  res.json({ ok: true });
});

function getLocalVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version; }
  catch { return '0.0.0'; }
}

app.get('/api/version', (req, res) => {
  res.json({ version: getLocalVersion() });
});

/* ── Notes de version : affichées une seule fois après chaque mise à jour ── */
function readChangelog() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'CHANGELOG.json'), 'utf8')); }
  catch { return {}; }
}
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
/* Première exécution après l'ajout de cette fonctionnalité :
   - toute nouvelle installation (settings.json inexistant avant ce lancement) → base silencieuse,
     rien à raconter à quelqu'un qui découvre l'app.
   - utilisateur déjà existant (settings.json présent mais sans lastSeenVersion, car plus ancien
     que cette fonctionnalité) → base à '0.0.0' pour que le prochain contrôle affiche bien les
     notes de la version qui vient d'arriver sur sa machine (celle qui inclut cette fonctionnalité). */
if (settings.lastSeenVersion === undefined) {
  settings.lastSeenVersion = _isFreshInstall ? getLocalVersion() : '0.0.0';
  saveSettings();
}

app.get('/api/changelog/unseen', (req, res) => {
  const current = getLocalVersion();
  if (compareVersions(settings.lastSeenVersion, current) >= 0) return res.json({ show: false });
  const changelog = readChangelog();
  const entries = Object.entries(changelog)
    .filter(([v]) => compareVersions(v, settings.lastSeenVersion) > 0 && compareVersions(v, current) <= 0)
    .sort((a, b) => compareVersions(a[0], b[0]))
    .map(([version, data]) => ({ version, date: data.date || '', notes: data.notes || [], notes_en: Array.isArray(data.notes_en) ? data.notes_en : null }));
  if (!entries.length) return res.json({ show: false });
  res.json({ show: true, current, entries });
});

app.post('/api/changelog/seen', (req, res) => {
  settings.lastSeenVersion = getLocalVersion();
  saveSettings();
  res.json({ ok: true });
});

/* ── Session auth (set by Electron main) ── */
let _session = null;
exports.setSession = (s) => {
  _session = s;
  /* salle de contrôle ouverte au dernier lancement : rouverte (même lien pour l'ami) ; déconnexion : fermée */
  if (s && s.license && settings.remoteOpen && !remote.open) remoteOpen(false).catch(e => { remote.error = e.message; remoteBroadcast(); });
  if (!s && remote.open) remoteClose();
};

app.get('/api/session', (req, res) => {
  if (!_session) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    username : _session.username,
    tier     : _session.tier || 'basic',
    license  : _session.license,
    token    : _session.token,
    avatarUrl: _session.avatar_url || null,
  });
});

/* ── Langue (fenêtres et menus d'Electron) ── */
exports.getLang = currentLang;
exports.setLang = setLang;
exports.readDict = lang => readDict(LANGS.includes(lang) ? lang : currentLang());
exports.onLangChange = (cb) => { _langCallback = cb; };
/* langue de Windows (app.getLocale) : utilisée tant que rien n'est choisi dans le panneau */
exports.setDefaultLocale = (loc) => { if (loc) detectedLang = langOfLocale(loc); };

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

/* ═══════════════════════════════════════════════════════════
   ASSISTANT DU PREMIER LANCEMENT
   Affiché dans le panneau à la toute première ouverture (nouvelle installation), relançable ensuite.
═══════════════════════════════════════════════════════════ */
if (settings.onboardingDone === undefined) { settings.onboardingDone = !_isFreshInstall; saveSettings(); }
app.post('/api/onboarding', (req, res) => {
  settings.onboardingDone = !(req.body && req.body.done === false);
  saveSettings();
  res.json({ ok: true, done: settings.onboardingDone });
});

/* ═══════════════════════════════════════════════════════════
   SAUVEGARDE DES RÉGLAGES
   Un .zip : backup.json (tous les réglages) + au choix logos, médias du bandeau, thèmes importés.
   Restauration : réglages remplacés (sauf ceux propres à cette installation), fichiers remis en place,
   puis l'overlay (OBS) et le panneau se rechargent.
═══════════════════════════════════════════════════════════ */
const BUILTIN_THEME_DIRS = new Set(['amber', 'enisorail', 'fifa-world-cup', 'neon', 'nord', 'onyx', 'rlcs2023', 'rlcs2025', 'rlcs2026']);
const BACKUP_SKIP_KEYS = new Set(['lastSeenVersion', 'reviewSubmitted', 'onboardingDone']);
const listDir = d => { try { return fs.readdirSync(d); } catch { return []; } };
function walkFiles(dir, base = dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkFiles(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}
const importedThemes = () => listThemes().filter(id => id !== 'rlcs' && !BUILTIN_THEME_DIRS.has(id));

app.get('/api/backup/info', (req, res) => {
  const size = files => files.reduce((s, f) => { try { return s + fs.statSync(f).size; } catch { return s; } }, 0);
  res.json({
    logos: ['bleu', 'orange'].reduce((n, s) => n + listDir(path.join(LOGOS_DIR, s)).length, 0),
    media: listUtils().length,
    mediaBytes: size(listUtils().map(u => path.join(UTILS_DIR, u.name))),
    themes: importedThemes(),
  });
});

app.get('/api/backup/export', (req, res) => {
  const want = k => req.query[k] !== '0';
  const s = {};
  for (const [k, v] of Object.entries(settings)) if (!BACKUP_SKIP_KEYS.has(k)) s[k] = v;
  if (s.goalClips) s.goalClips = { ...s.goalClips, password: undefined };   // mot de passe d'OBS : pas dans le fichier
  const manifest = {
    format: 'rl-overlay-backup', version: 1, app: getLocalVersion(), createdAt: new Date().toISOString(),
    contents: { settings: true, logos: want('logos'), media: want('media'), themes: want('themes') }, settings: s,
  };
  const files = [{ name: 'backup.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) }];
  try {
    if (want('logos')) for (const side of ['bleu', 'orange'])
      for (const f of listDir(path.join(LOGOS_DIR, side))) files.push({ name: `logos/${side}/${f}`, data: fs.readFileSync(path.join(LOGOS_DIR, side, f)), store: true });
    if (want('media')) for (const u of listUtils()) files.push({ name: `media/${u.name}`, data: fs.readFileSync(path.join(UTILS_DIR, u.name)), store: true });
    /* musique de l'écran de timeout : avec les médias */
    if (want('media')) for (const f of listDir(TIMEOUT_DIR)) if (AUDIO_EXTS.has(path.extname(f).toLowerCase())) files.push({ name: `timeout/${f}`, data: fs.readFileSync(path.join(TIMEOUT_DIR, f)), store: true });
    if (want('themes')) for (const id of importedThemes()) {
      const dir = path.join(THEMES_DIR, id);
      for (const rel of walkFiles(dir)) files.push({ name: `themes/${id}/${rel}`, data: fs.readFileSync(path.join(dir, rel)), store: /\.(png|jpe?g|webp|gif|mp4|webm|mov|mkv|avi|ttf|otf|woff2?)$/i.test(rel) });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
  const stamp = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'application/zip')
    .set('Content-Disposition', `attachment; filename="RL-Overlay-sauvegarde-${stamp}.zip"`)
    .send(makeZip(files));
});

/* Toutes les entrées d'un ZIP avec leur chemin (dossiers et fichiers système macOS ignorés) */
function readZipAll(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(new Error("Ce fichier n'est pas un ZIP valide"));
      const files = new Map();
      zipfile.readEntry();
      zipfile.on('entry', entry => {
        const name = entry.fileName.replace(/\\/g, '/');
        if (/\/$/.test(name) || /(^|\/)__MACOSX\//.test(name) || path.basename(name).startsWith('._')) { zipfile.readEntry(); return; }
        zipfile.openReadStream(entry, (e, rs) => {
          if (e) { zipfile.readEntry(); return; }
          const chunks = [];
          rs.on('data', c => chunks.push(c));
          rs.on('end', () => { files.set(name, Buffer.concat(chunks)); zipfile.readEntry(); });
          rs.on('error', () => zipfile.readEntry());
        });
      });
      zipfile.on('end', () => resolve(files));
      zipfile.on('error', () => reject(new Error('ZIP illisible')));
    });
  });
}

app.post('/api/backup/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  let entries;
  try { entries = await readZipAll(req.file.buffer); } catch (e) { return res.status(400).json({ error: e.message }); }
  let man = null;
  try { man = JSON.parse(entries.get('backup.json').toString('utf8')); } catch {}
  if (!man || man.format !== 'rl-overlay-backup' || !man.settings || typeof man.settings !== 'object')
    return res.status(400).json({ error: "Ce fichier n'est pas une sauvegarde RL Overlay" });

  const done = { logos: 0, media: 0, themes: new Set() }, clearedSides = new Set();
  for (const [name, buf] of entries) {
    const parts = name.split('/');
    if (parts.some(p => !p || p === '.' || p === '..')) continue;
    const ext = path.extname(parts[parts.length - 1]).toLowerCase();
    if (parts[0] === 'logos' && parts.length === 3 && ['bleu', 'orange'].includes(parts[1]) && IMG_EXTS.has(ext)) {
      const dir = path.join(LOGOS_DIR, parts[1]);
      if (!clearedSides.has(parts[1])) { clearedSides.add(parts[1]); for (const f of listDir(dir)) try { fs.unlinkSync(path.join(dir, f)); } catch {} }
      fs.writeFileSync(path.join(dir, parts[2]), buf); done.logos++;
    } else if (parts[0] === 'media' && parts.length === 2 && (IMG_EXTS.has(ext) || VIDEO_EXTS.has(ext))) {
      fs.writeFileSync(path.join(UTILS_DIR, parts[1]), buf); done.media++;
    } else if (parts[0] === 'timeout' && parts.length === 2 && AUDIO_EXTS.has(ext)) {
      for (const f of listDir(TIMEOUT_DIR)) try { fs.unlinkSync(path.join(TIMEOUT_DIR, f)); } catch {}
      fs.writeFileSync(path.join(TIMEOUT_DIR, parts[1]), buf); done.media++;
    } else if (parts[0] === 'themes' && parts.length >= 3 && /^[\w.-]+$/.test(parts[1]) && parts[1] !== 'rlcs' && !BUILTIN_THEME_DIRS.has(parts[1])) {
      const dest = path.join(THEMES_DIR, ...parts.slice(1));
      if (!dest.startsWith(path.join(THEMES_DIR, parts[1]) + path.sep)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf); done.themes.add(parts[1]);
    }
  }
  /* réglages : remplacés, puis remis en forme comme au démarrage */
  const obsPass = settings.goalClips && settings.goalClips.password;   // mot de passe d'OBS de ce PC (absent des sauvegardes)
  for (const [k, v] of Object.entries(man.settings)) if (!BACKUP_SKIP_KEYS.has(k)) settings[k] = v;
  if (settings.goalClips && typeof settings.goalClips === 'object') { if (!settings.goalClips.password && obsPass) settings.goalClips.password = obsPass; }
  else delete settings.goalClips;
  settings.mediaBanner = { enabled: false, interval: 60, group: null, ...(settings.mediaBanner || {}) };
  settings.animations = { goal: true, replay: true, live: true, endScreen: true, ...(settings.animations || {}) };
  settings.themeNames = settings.themeNames || {};
  settings.mediaGroups = Array.isArray(settings.mediaGroups) ? settings.mediaGroups : [];
  settings.playerLinks = settings.playerLinks || {};
  settings.seriesHistory = Array.isArray(settings.seriesHistory) ? settings.seriesHistory : [];
  if (!listThemes().includes(settings.theme)) settings.theme = 'rlcs';
  currentTheme = settings.theme || 'rlcs';
  saveSettings();
  applySettings();
  if (settings.twitch && settings.twitch.channel) twitchConnect(settings.twitch.channel);
  gcApply();   // clips des buts : connexion à OBS selon les réglages restaurés
  /* overlay (OBS) et panneau : rechargés avec les réglages restaurés */
  setTimeout(() => broadcast('reload_all', {}), 300);
  res.json({ ok: true, restored: { logos: done.logos, media: done.media, themes: [...done.themes] }, from: man.app || '' });
});

/* ═══════════════════════════════════════════════════════════
   PAGE DES SCORES (scène de fin OBS) : /scores.html
   Équipes, score de la série et chaque game jouée, mis à jour tout seuls.
═══════════════════════════════════════════════════════════ */
settings.seriesHistory = Array.isArray(settings.seriesHistory) ? settings.seriesHistory : [];
function scoresPayload() {
  const t = gameState.game.teams;
  return {
    league: gameState.meta.league || '',
    teams: [0, 1].map(i => ({ name: t[i].name, tag: t[i].tag || '', logo: t[i].logo_url || '' })),
    series: gameState.series,
    history: settings.seriesHistory,
    lastGame: settings.lastGame || null,
    theme: currentTheme,
  };
}
/* fin d'une game : score, vainqueur, stats des joueurs (counts = la game compte dans la série) */
function recordGameResult(winner, counts) {
  const t = gameState.game.teams;
  const game = {
    n: counts ? settings.seriesHistory.length + 1 : 1,
    winner, at: Date.now(),
    scores: [t[0].score ?? 0, t[1].score ?? 0],
    names: [t[0].name, t[1].name],
    players: Object.values(gameState.game.players || {}).filter(p => p.id !== '__manual_spec__').map(p => ({
      name: p.name, team: p.team, score: p.score ?? 0, goals: p.goals ?? 0, assists: p.assists ?? 0, saves: p.saves ?? 0, shots: p.shots ?? 0, demos: p.demos ?? 0,
    })),
  };
  if (counts) settings.seriesHistory.push(game);
  settings.lastGame = game;
  saveSettings();
  broadcast('scores_update', scoresPayload());
}
app.get('/api/scores', (req, res) => res.json(scoresPayload()));

/* ═══════════════════════════════════════════════════════════
   VOTE DU CHAT TWITCH (façon RLCS)
   Lecture du chat en anonyme (aucun compte Twitch à connecter) : chaque spectateur vote en écrivant le
   hashtag d'une équipe (#VIT / #KC…). Un seul vote par compte, définitif (pas de changement d'avis).
   La page vote.html (source OBS à part) affiche les pourcentages et le temps restant, puis le résultat.
═══════════════════════════════════════════════════════════ */
settings.twitch = { channel: '', duration: 60, title: '', ...(settings.twitch || {}) };
const poll = { connected: false, error: '', active: false, visible: false, ended: false, tags: ['', ''], title: '', duration: 60, endsAt: 0, votes: new Map(), counts: [0, 0] };
let twitchWs = null, twitchChannel = '', twitchRetryT = null, pollEndT = null, pollHideT = null, pollBcastT = null, pollBcastLast = 0;

const cleanChannel = c => String(c || '').trim().toLowerCase().replace(/^(https?:\/\/)?(www\.|m\.)?twitch\.tv\//, '').replace(/^[#@]/, '').split(/[/?#\s]/)[0];
const cleanHashtag = t => { const s = String(t || '').toUpperCase().replace(/[^\p{L}\p{N}_]/gu, ''); return s ? '#' + s.slice(0, 12) : ''; };
function defaultPollTags() {
  const tag = i => { const t = gameState.game.teams[i]; return cleanHashtag(t.tag || [...String(t.name || '').replace(/\s+/g, '')].slice(0, 4).join('')); };
  let a = tag(0) || '#BLUE', b = tag(1) || '#ORANGE';
  if (a === b) { a += '1'; b += '2'; }
  return [a, b];
}
function pollPayload() {
  const total = poll.counts[0] + poll.counts[1];
  return {
    channel: settings.twitch.channel, connected: poll.connected, error: poll.error,
    active: poll.active, visible: poll.visible, ended: poll.ended,
    tags: poll.active || poll.ended ? poll.tags : defaultPollTags(), title: poll.title, duration: poll.duration,
    endsAt: poll.endsAt, remaining: poll.active ? Math.max(0, poll.endsAt - Date.now()) : 0,
    counts: poll.counts, total,
    saved: { title: settings.twitch.title || '', duration: settings.twitch.duration || 60 },   // champs du panneau
  };
}
/* au plus ~4 envois par seconde pendant un vote (le chat peut aller très vite) */
function pollBroadcast(now) {
  clearTimeout(pollBcastT);
  const wait = now ? 0 : Math.max(0, 250 - (Date.now() - pollBcastLast));
  pollBcastT = setTimeout(() => { pollBcastLast = Date.now(); broadcast('twitch_poll', pollPayload()); }, wait);
}
function twitchDisconnect() {
  clearTimeout(twitchRetryT);
  const ws = twitchWs; twitchWs = null;
  if (ws) { try { ws.close(); } catch {} }
  poll.connected = false;
}
function twitchConnect(channel) {
  channel = cleanChannel(channel);
  if (!/^[a-z0-9_]{2,25}$/.test(channel)) {
    twitchDisconnect(); twitchChannel = ''; poll.error = channel ? 'Nom de chaîne Twitch invalide' : '';
    pollBroadcast(true); return;
  }
  if (twitchWs && twitchChannel === channel) return;
  twitchDisconnect();
  twitchChannel = channel; poll.error = '';
  const ws = new WebSocket(process.env.TWITCH_IRC_URL || 'wss://irc-ws.chat.twitch.tv:443');   // TWITCH_IRC_URL : tests
  twitchWs = ws;
  ws.on('open', () => {
    ws.send('CAP REQ :twitch.tv/tags');
    ws.send('PASS SCHMOOPIIE');
    ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 89999));
    ws.send('JOIN #' + channel);
  });
  ws.on('message', buf => {
    for (const line of String(buf).split('\r\n')) {
      if (!line) continue;
      if (line.startsWith('PING')) { try { ws.send(line.replace('PING', 'PONG')); } catch {} continue; }
      handleTwitchLine(line);
    }
  });
  ws.on('close', () => {
    if (twitchWs !== ws) return;
    poll.connected = false; pollBroadcast(true);
    twitchRetryT = setTimeout(() => { twitchWs = null; twitchConnect(channel); }, 5000);   // reconnexion automatique
  });
  ws.on('error', e => { poll.error = 'Twitch injoignable'; console.warn('[Twitch]', e.message); });
}
function handleTwitchLine(line) {
  if (/ JOIN #/.test(line) || / 366 /.test(line)) { if (!poll.connected) { poll.connected = true; poll.error = ''; pollBroadcast(true); } return; }
  const m = /^(?:@(\S+) )?:([^!\s]+)!\S+ PRIVMSG #\S+ :(.*)$/.exec(line);
  if (!m || !poll.active) return;
  const tags = {};
  if (m[1]) for (const kv of m[1].split(';')) { const i = kv.indexOf('='); tags[kv.slice(0, i)] = kv.slice(i + 1); }
  const voter = tags['user-id'] || m[2];
  const words = (m[3].match(/#[\p{L}\p{N}_]+/gu) || []).map(w => w.toUpperCase());
  const forA = words.includes(poll.tags[0]), forB = words.includes(poll.tags[1]);
  if (forA === forB) return;                      // aucun hashtag, ou les deux : ignoré
  if (poll.votes.has(voter)) return;              // un seul vote par compte, définitif : pas de changement d'avis
  const side = forA ? 0 : 1;
  poll.votes.set(voter, side); poll.counts[side]++;
  pollBroadcast();
}
function endPoll() {
  clearTimeout(pollEndT);
  if (!poll.active) return;
  poll.active = false; poll.ended = true;
  pollBroadcast(true);
  /* résultat affiché 20 s puis masqué */
  clearTimeout(pollHideT);
  pollHideT = setTimeout(() => { poll.visible = false; pollBroadcast(true); }, 20000);
}
app.get('/api/twitch-poll', (req, res) => res.json(pollPayload()));
app.post('/api/twitch-poll', (req, res) => {
  const { action, channel, duration, tags, title } = req.body || {};
  if (channel !== undefined) {
    settings.twitch.channel = cleanChannel(channel); twitchConnect(settings.twitch.channel);
    if (!settings.twitch.channel && poll.active) endPoll();   // chaîne déliée pendant un vote : vote arrêté (résultat affiché)
  }
  if (duration !== undefined) { const d = Math.round(Number(duration)); if (Number.isFinite(d)) settings.twitch.duration = Math.min(900, Math.max(10, d)); }
  if (title !== undefined) settings.twitch.title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  saveSettings();
  if (action === 'start') {
    if (!poll.connected) return res.status(400).json({ error: 'Chaîne Twitch non connectée', poll: pollPayload() });
    const tg = Array.isArray(tags) ? tags.map(cleanHashtag) : [];
    poll.tags = tg[0] && tg[1] && tg[0] !== tg[1] ? tg : defaultPollTags();
    poll.votes.clear(); poll.counts = [0, 0];
    poll.title = settings.twitch.title; poll.duration = settings.twitch.duration;
    poll.active = true; poll.ended = false; poll.visible = true;
    poll.endsAt = Date.now() + poll.duration * 1000;
    clearTimeout(pollEndT); clearTimeout(pollHideT);
    pollEndT = setTimeout(endPoll, poll.duration * 1000);
  } else if (action === 'stop') endPoll();
  else if (action === 'show') { poll.visible = true; clearTimeout(pollHideT); }
  else if (action === 'hide') { poll.visible = false; clearTimeout(pollHideT); }
  else if (action === 'reset') {
    clearTimeout(pollEndT); clearTimeout(pollHideT);
    poll.active = false; poll.ended = false; poll.visible = false; poll.votes.clear(); poll.counts = [0, 0];
  }
  pollBroadcast(true);
  res.json({ ok: true, poll: pollPayload() });
});
if (settings.twitch.channel) twitchConnect(settings.twitch.channel);

/* ═══════════════════════════════════════════════════════════
   SALLE DE CONTRÔLE À DISTANCE (côté app)
   Le panneau ouvre une salle sur overlay.rscast.fr (licence du compte connecté) et affiche le lien à donner
   à un ami. L'app vient chercher ses commandes (requête en attente : réponse dès qu'il agit), les applique
   comme si elles venaient du panneau, puis publie l'état de l'overlay pour sa page. Aucun port à ouvrir.
   La salle se rouvre toute seule au prochain lancement si elle était ouverte (même lien).
   Le lien ne suffit pas : l'ami doit aussi entrer le code de sécurité (6 chiffres tirés au hasard par le
   site) affiché dans le panneau. Chaque code faux saisi sur la page de la salle est signalé dans le panneau.
═══════════════════════════════════════════════════════════ */
const ROOM_SITE = process.env.ROOM_SITE || 'https://overlay.rscast.fr';   // ROOM_SITE : tests
const remote = { open: false, id: '', ownerKey: '', url: '', code: '', bad: 0, guestOnline: false, error: '', after: 0, log: [] };
let remoteAbort = null, remotePushT = null, remoteTick = null, remoteLastState = '', remoteResults = [], remoteLogoSig = {}, remoteLooping = false;
const LOGO_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif' };
const REMOTE_LABELS = {
  teams: 'a modifié les équipes', series: 'a modifié la série', swap: 'a inversé les équipes', logo: 'a changé un logo',
  logoDelete: 'a retiré un logo', overlay: "a changé l'affichage de l'overlay", boost: 'a changé le boost meter',
  video: 'a changé le flux vidéo joueur', videoHideEmpty: 'a changé le flux vidéo joueur', playerLink: 'a modifié un lien vidéo', theme: 'a changé le thème',
  timeout: 'a lancé un timeout', timeoutCancel: 'a annulé un timeout',
};
const remotePayload = () => ({ open: remote.open, url: remote.url, code: remote.code, guestOnline: remote.guestOnline, error: remote.error, log: remote.log.slice(-6) });
function remoteLog(entry) { remote.log.push({ at: Date.now(), ...entry }); if (remote.log.length > 20) remote.log.shift(); }
const remoteBroadcast = () => broadcast('remote_room', remotePayload());
function remoteSetGuest(on) { on = !!on; if (on !== remote.guestOnline) { remote.guestOnline = on; remoteBroadcast(); } }
async function remoteFetch(p, opts = {}) {
  const r = await fetch(ROOM_SITE + p, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'HTTP ' + r.status); e.closed = !!j.closed || r.status === 404 || r.status === 403; throw e; }
  return j;
}
/* commandes appliquées par l'API locale, exactement comme depuis le panneau */
async function localCall(p, body) {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
function remoteState() {
  const t = gameState.game.teams, names = themeDisplayNames();
  return {
    app: getLocalVersion(),
    league: settings.league ?? gameState.meta.league ?? '',
    teams: [0, 1].map(i => ({ name: manualTeamName(i), tag: manualTeamTag(i), display: t[i].name })),
    series: { blue: gameState.series.blue, orange: gameState.series.orange, bestOf: gameState.series.bestOf },
    overlayVisible, boostVisible,
    playerVideo: { enabled: !!settings.playerVideoEnabled, hideEmpty: !!settings.playerVideoHideEmpty },
    players: Object.values(gameState.game.players || {}).filter(p => p.id !== '__manual_spec__').map(p => ({ name: p.name, team: p.team })),
    links: settings.playerLinks || {},
    theme: currentTheme,
    themes: listThemes().map(id => ({ id, name: names[id] || (id === 'rlcs' ? 'Default' : id) })),
    timeouts: timeoutsState(),
    game: { connected: !!gameState.connected, hasGame: !!gameState.hasGame },
  };
}
/* état publié s'il a changé (+ résultats des commandes), logos envoyés quand ils changent */
async function remotePush(force) {
  if (!remote.open) return;
  const st = remoteState(), json = JSON.stringify(st), results = remoteResults.splice(0);
  try {
    if (force || json !== remoteLastState || results.length) {
      const j = await remoteFetch(`/api/room/${remote.id}/state`, { method: 'POST', body: JSON.stringify({ ownerKey: remote.ownerKey, state: st, results }) });
      remoteLastState = json; remoteSetGuest(j.guestOnline);
    }
    for (const side of ['bleu', 'orange']) {
      const url = findLogo(side), file = url ? path.join(LOGOS_DIR, side, path.basename(url)) : '';
      let sig = '';
      if (file) { try { const s = fs.statSync(file); sig = `${url}|${s.size}|${s.mtimeMs}`; } catch {} }
      if (!force && remoteLogoSig[side] === sig) continue;
      const buf = sig ? fs.readFileSync(file) : Buffer.alloc(0);
      await fetch(`${ROOM_SITE}/api/room/${remote.id}/asset/logo-${side}?ownerKey=${encodeURIComponent(remote.ownerKey)}`, {
        method: 'POST', headers: { 'Content-Type': LOGO_MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }, body: buf,
      });
      remoteLogoSig[side] = sig;
    }
  } catch (e) { remoteResults.unshift(...results); if (e.closed) remoteLost(); }
}
function remoteSchedulePush(ms = 400) { clearTimeout(remotePushT); remotePushT = setTimeout(() => remotePush(), ms); }

/* ── Logos reçus de la salle de contrôle ──
   Le fichier vient d'un tiers : il n'est jamais écrit tel quel dans les logos (lus par OBS et le panneau).
   1. type réel lu sur ses premiers octets (pas sur son nom) : PNG, JPEG, WebP ou GIF — SVG refusé (peut contenir du code) ;
   2. poids (3 Mo) et dimensions lues dans l'en-tête (4096 px) bornés AVANT tout décodage (pas d'image « bombe ») ;
   3. décodé dans une fenêtre cachée isolée (bac à sable Chromium, ni Node ni accès au PC), réduit à 1024 px max
      et ré-encodé en PNG : code caché, données ajoutées après l'image, métadonnées… tout disparaît. */
const REMOTE_LOGO_MAX = 3 * 1024 * 1024, REMOTE_LOGO_DIM = 4096;
function sniffImage(buf) {
  if (!buf || buf.length < 16) return null;
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  const g = buf.toString('latin1', 0, 6);
  if (g === 'GIF87a' || g === 'GIF89a') return 'gif';
  return null;
}
/* largeur × hauteur lues dans l'en-tête, sans décoder l'image (null = en-tête illisible) */
function imageDims(buf, type) {
  try {
    if (type === 'png') return buf.toString('latin1', 12, 16) === 'IHDR' ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null;
    if (type === 'gif') return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    if (type === 'webp') {
      const c = buf.toString('latin1', 12, 16);
      if (c === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3FFF, h: buf.readUInt16LE(28) & 0x3FFF };
      if (c === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3FFF) + 1, h: ((b >>> 14) & 0x3FFF) + 1 }; }
      if (c === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
      return null;
    }
    if (type === 'jpeg') {
      for (let i = 2; i + 9 < buf.length;) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7) || m === 0xFF) { i += m === 0xFF ? 1 : 2; continue; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {}
  return null;
}
/* décodage + ré-encodage PNG dans une fenêtre cachée en bac à sable (réutilisée, recréée si elle a planté) */
let _logoWin = null;
async function reencodeInSandbox(buf, type) {
  const { BrowserWindow } = require('electron');
  if (!_logoWin || _logoWin.isDestroyed() || _logoWin.webContents.isCrashed()) {
    if (_logoWin && !_logoWin.isDestroyed()) _logoWin.destroy();
    _logoWin = new BrowserWindow({ show: false, width: 64, height: 64, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
    await _logoWin.loadURL('about:blank');
  }
  const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[type];
  let timer;
  const out = await Promise.race([
    _logoWin.webContents.executeJavaScript(`(async () => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(buf.toString('base64'))}), ch => ch.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: ${JSON.stringify(mime)} }));
      const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      return c.toDataURL('image/png');
    })()`),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('délai dépassé')), 10000); }),
  ]).finally(() => clearTimeout(timer));
  const png = Buffer.from(String(out).split(',')[1] || '', 'base64');
  if (sniffImage(png) !== 'png') throw new Error('ré-encodage impossible');
  return png;
}
async function safeRemoteLogo(buf) {
  if (!buf || !buf.length) throw new Error('Logo introuvable');
  if (buf.length > REMOTE_LOGO_MAX) throw new Error('Image trop lourde (3 Mo max)');
  const type = sniffImage(buf);
  if (!type) throw new Error('Fichier refusé : ce n\'est pas une image PNG, JPG, WebP ou GIF');
  const d = imageDims(buf, type);
  if (!d || d.w < 1 || d.h < 1 || d.w > REMOTE_LOGO_DIM || d.h > REMOTE_LOGO_DIM) throw new Error('Image refusée : dimensions illisibles ou trop grandes (4096 × 4096 px max)');
  /* app lancée hors Electron (node server.js) : pas de bac à sable pour décoder → PNG / JPEG vérifiés seulement */
  if (!process.versions.electron) {
    if (type === 'png' || type === 'jpeg') return { buf, ext: type === 'png' ? '.png' : '.jpg' };
    throw new Error('Format accepté ici : PNG ou JPG');
  }
  try { return { buf: await reencodeInSandbox(buf, type), ext: '.png' }; }
  catch { throw new Error('Image illisible ou endommagée : logo refusé'); }
}

async function runRemoteCmd(c) {
  const a = c.args || {};
  const side = a.side === 'orange' ? 'orange' : 'bleu';
  switch (c.type) {
    case 'teams': {
      const body = {};
      if (a.league !== undefined) body.league = String(a.league ?? '').slice(0, 80);
      for (const k of ['blue', 'orange']) if (a[k] && typeof a[k] === 'object') body[k] = { name: String(a[k].name ?? '').slice(0, 40), tag: String(a[k].tag ?? '').slice(0, 8) };
      return localCall('/api/settings', body);
    }
    case 'series': {
      const n = v => Math.max(0, Math.min(7, Math.round(Number(v)) || 0));
      const body = { blue: n(a.blue), orange: n(a.orange) };
      if ([0, 1, 3, 5, 7].includes(Number(a.bestOf))) body.bestOf = Number(a.bestOf);
      return localCall('/api/series', body);
    }
    case 'swap': return localCall('/api/swap-teams', {});
    case 'logo': {
      /* jamais écrit tel quel : vérifié puis ré-encodé en PNG (voir safeRemoteLogo) — l'extension annoncée est ignorée */
      const r = await fetch(`${ROOM_SITE}/api/room/${remote.id}/file/${encodeURIComponent(String(a.file || ''))}?ownerKey=${encodeURIComponent(remote.ownerKey)}`);
      if (!r.ok) throw new Error('Logo introuvable');
      const len = Number(r.headers.get('content-length')) || 0;
      if (len > REMOTE_LOGO_MAX) throw new Error('Image trop lourde (3 Mo max)');
      const safe = await safeRemoteLogo(Buffer.from(await r.arrayBuffer()));
      setTeamLogo(side, safe.buf, safe.ext);
      return;
    }
    case 'logoDelete': return localCall(`/api/delete-logo/${side}`, {});
    case 'overlay': return localCall('/api/overlay-visible', { visible: !!a.visible });
    case 'boost': return localCall('/api/boost-visible', { visible: !!a.visible });
    case 'video': return localCall('/api/player-video-toggle', { enabled: !!a.enabled });
    case 'videoHideEmpty': return localCall('/api/player-video-hide-empty', { enabled: !!a.enabled });
    case 'playerLink': {
      const name = String(a.name || '').trim().slice(0, 40), url = String(a.url || '').trim().slice(0, 500);
      if (!name) throw new Error('Pseudo requis');
      if (url && !/^https?:\/\//i.test(url)) throw new Error('Le lien doit commencer par https://');
      return localCall('/api/player-link', { name, url });
    }
    case 'theme': {
      if (!listThemes().includes(a.theme)) throw new Error('Thème introuvable');
      return localCall('/api/theme', { theme: a.theme });
    }
    case 'timeout': return localCall('/api/timeouts', { team: a.team === 1 ? 1 : 0, used: a.used !== false });
    default: throw new Error('Action inconnue');
  }
}
async function remoteLoop() {
  if (remoteLooping) return;
  remoteLooping = true;
  while (remote.open) {
    const ctrl = new AbortController(); remoteAbort = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 40000);
    try {
      const j = await remoteFetch(`/api/room/${remote.id}/poll?ownerKey=${encodeURIComponent(remote.ownerKey)}&after=${remote.after}`, { signal: ctrl.signal });
      clearTimeout(timeout);
      remoteSetGuest(j.guestOnline);
      if (remote.error) { remote.error = ''; remoteBroadcast(); }
      /* code de sécurité faux saisi sur la page de la salle (l'ami qui se trompe… ou quelqu'un d'autre) */
      if (Number(j.bad) > remote.bad) {
        remote.bad = Number(j.bad);
        remoteLog({ type: 'badCode', ok: false, text: j.locked ? '5 codes incorrects : accès bloqué 15 min. Si ce n\'est pas ton ami, crée un nouveau lien.' : 'Code de sécurité incorrect saisi sur la page de la salle' });
        remoteBroadcast();
      }
      for (const c of j.cmds || []) {
        if (c.seq <= remote.after) continue;
        remote.after = c.seq;
        let ok = true, error = '';
        try { await runRemoteCmd(c); } catch (e) { ok = false; error = e.message; }
        remoteResults.push({ seq: c.seq, type: c.type, ok, error });
        const label = c.type === 'timeout' && c.args && c.args.used === false ? REMOTE_LABELS.timeoutCancel : REMOTE_LABELS[c.type];
        remoteLog({ type: c.type, ok, text: label || c.type, error });
        broadcast('remote_change', { type: c.type, ok, error });
        remoteBroadcast();
      }
      if ((j.cmds || []).length) remoteSchedulePush(150);
    } catch (e) {
      clearTimeout(timeout);
      if (!remote.open) break;
      if (e.closed) { remoteLost(); break; }
      if (e.name !== 'AbortError') { remote.error = 'Site injoignable, nouvel essai…'; remoteBroadcast(); await new Promise(r => setTimeout(r, 4000)); }
    }
  }
  remoteLooping = false;
}
function remoteStop() { remote.open = false; remote.code = ''; clearInterval(remoteTick); clearTimeout(remotePushT); if (remoteAbort) try { remoteAbort.abort(); } catch {} }
function remoteLost() { remoteStop(); remote.error = 'La salle a expiré : ouvre-en une nouvelle'; settings.remoteOpen = false; saveSettings(); remoteBroadcast(); }
async function remoteOpen(rotate) {
  if (!_session || !_session.license) throw new Error("Connecte-toi à ton compte RL Overlay dans l'app");
  const j = await remoteFetch('/api/room/open', { method: 'POST', body: JSON.stringify({ key: _session.license, rotate: !!rotate }) });
  const same = remote.open && remote.id === j.id;
  Object.assign(remote, { open: true, id: j.id, ownerKey: j.ownerKey, url: j.url, code: String(j.code || ''), error: '' });
  if (!same) { remote.after = Number(j.seq) || 0; remote.log = []; }
  remote.bad = Number(j.bad) || 0;   // codes faux d'avant : pas re-signalés
  remoteSetGuest(j.guestOnline);
  remoteLastState = ''; remoteLogoSig = {};
  settings.remoteOpen = true; saveSettings();
  await remotePush(true);
  remoteLoop();
  /* état republié s'il change (joueurs qui arrivent, noms détectés en jeu…) */
  clearInterval(remoteTick); remoteTick = setInterval(() => remotePush(), 2500);
  remoteBroadcast();
}
/* nouveau code de sécurité : l'ami connecté doit entrer le nouveau (le lien reste le même) */
async function remoteNewCode() {
  if (!remote.open) throw new Error('La salle est fermée');
  try {
    const j = await remoteFetch(`/api/room/${remote.id}/code`, { method: 'POST', body: JSON.stringify({ ownerKey: remote.ownerKey }) });
    remote.code = String(j.code || ''); remote.bad = Math.max(remote.bad, Number(j.bad) || 0); remote.guestOnline = !!j.guestOnline;
    remoteBroadcast();
  } catch (e) { if (e.closed) remoteLost(); throw e; }
}
async function remoteClose() {
  const { id, ownerKey, open } = remote;
  remoteStop(); remote.error = ''; remote.guestOnline = false;
  settings.remoteOpen = false; saveSettings();
  remoteBroadcast();
  if (open) { try { await remoteFetch(`/api/room/${id}/close`, { method: 'POST', body: JSON.stringify({ ownerKey }) }); } catch {} }
}
app.get('/api/remote', (req, res) => res.json(remotePayload()));
app.post('/api/remote', async (req, res) => {
  const action = req.body && req.body.action;
  try {
    if (action === 'open') await remoteOpen(false);
    else if (action === 'rotate') await remoteOpen(true);
    else if (action === 'code') await remoteNewCode();
    else if (action === 'close') await remoteClose();
    else return res.status(400).json({ error: 'Action inconnue' });
    res.json({ ok: true, remote: remotePayload() });
  } catch (e) {
    remote.error = e.message; remoteBroadcast();
    res.status(400).json({ error: e.message, remote: remotePayload() });
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

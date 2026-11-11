/* ══════════════════════════════════════════════════════════════════════════════
   Studio de thèmes — RL Overlay
   Éditeur visuel : l'aperçu est le VRAI overlay (global.html?preview&studio) dans une
   iframe, piloté par public/studio/runtime.js (window.__studio). Le projet est un objet
   JSON ; il génère un thème normal (theme.css + meta.json + fichiers) à l'installation.
══════════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ─────────────────────────── Outils ─────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v, d = 0) => { const k = 10 ** d; return Math.round((+v || 0) * k) / k; };
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
const clone = o => JSON.parse(JSON.stringify(o));
const W = 1920, H = 1080;
const isInput = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

const ICONS = {
  chev: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  save: '<path d="M5 3h11l5 5v13H3V3z"/><path d="M7 3v6h8M7 21v-7h10v7"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 4h16"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  video: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3z"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  shape: '<circle cx="8" cy="8" r="5"/><rect x="11" y="11" width="10" height="10" rx="1.5"/>',
  sparkle: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.9 0 3.5-.5 4.9-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  fit: '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',
  magnet: '<path d="M5 4h4v7a3 3 0 0 0 6 0V4h4v7a7 7 0 0 1-14 0z"/><path d="M5 8h4M15 8h4"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.8-9-7.8z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  board: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M9 7v10M15 7v10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  bar: '<rect x="2" y="9" width="20" height="8" rx="2"/><path d="M6 13h5"/>',
  gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="M12 14l4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flipH: '<path d="M12 3v18"/><path d="M8 7L3 12l5 5zM16 7l5 5-5 5z"/>',
  flipV: '<path d="M3 12h18"/><path d="M7 8l5-5 5 5zM7 16l5 5 5-5z"/>',
  aL: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  aC: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  aR: '<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>',
  aT: '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>',
  aM: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  aB: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>',
  txL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  txC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  txR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  pointer: '<path d="M5 3l14 8-6 2-3 6z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  folderOpen: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"/><path d="M3 6v12a2 2 0 0 0 2 2h12.5a2 2 0 0 0 1.9-1.4L22 11H7.5a2 2 0 0 0-1.9 1.4L3 19"/>',
  folderPlus: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>',
  media: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M10 9.5l4.5 2.5-4.5 2.5z"/>',
  distH: '<path d="M4 3v18M20 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  bAll: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-width="3"/>',
  bT: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-opacity=".3"/><path d="M4 4h16" stroke-width="3.2"/>',
  bR: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-opacity=".3"/><path d="M20 4v16" stroke-width="3.2"/>',
  bB: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-opacity=".3"/><path d="M4 20h16" stroke-width="3.2"/>',
  bL: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-opacity=".3"/><path d="M4 4v16" stroke-width="3.2"/>',
  pips: '<rect x="2.5" y="8" width="5" height="8" rx="1"/><rect x="9.5" y="8" width="5" height="8" rx="1"/><rect x="16.5" y="8" width="5" height="8" rx="1" fill="currentColor"/>',
  distV: '<path d="M3 4h18M3 20h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
};
const icon = n => `<i data-i="${n}"><svg viewBox="0 0 24 24">${ICONS[n] || ''}</svg></i>`;
function hydrateIcons(root = document) {
  $$('i[data-i]', root).forEach(i => { if (!i.firstChild && ICONS[i.dataset.i]) i.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[i.dataset.i]}</svg>`; });
}

/* ─────────────────────────── Catalogues ─────────────────────────── */
const SCENES = { game: 'En jeu', goal: 'But', wreplay: 'Anim. REPLAY', replay: 'Replay', wlive: 'Anim. LIVE', ot: 'Prolongation', end: 'Fin de match', win: 'Victoire' };

/* Éléments de l'overlay déplaçables (id DOM de global.html, ou sélecteur « sel ») */
const ELEMENTS = [
  { key: 'top-bar',          label: 'Scoreboard',            scene: 'game',   icon: 'board' },
  { key: 'league-label',     label: 'Nom de la ligue',       scene: 'game',   icon: 'text' },
  { key: 'logo-blue',        label: 'Logo équipe bleue',     scene: 'game',   icon: 'shield', sel: '.team-logo-outer.blue' },
  { key: 'logo-orange',      label: 'Logo équipe orange',    scene: 'game',   icon: 'shield', sel: '.team-logo-outer.orange' },
  { key: 'sidebar-blue',     label: 'Sidebar bleue',         scene: 'game',   icon: 'list' },
  { key: 'sidebar-orange',   label: 'Sidebar orange',        scene: 'game',   icon: 'list' },
  { key: 'stat-bar',         label: 'Stat bar',              scene: 'game',   icon: 'bar' },
  { key: 'boost-meter',      label: 'Boost meter',           scene: 'game',   icon: 'gauge' },
  { key: 'media-banner',     label: 'Bandeau médias',        scene: 'game',   icon: 'image', optional: 'mb-on' },
  { key: 'player-video-box', label: 'Flux vidéo joueur',     scene: 'game',   icon: 'video', optional: 'show' },
  { key: 'goal-notif',       label: 'Notification de but',   scene: 'goal',   icon: 'zap' },
  { key: 'replay-bar',       label: 'Barre de replay',       scene: 'replay', icon: 'replay' },
  { key: 'ot-notif',         label: 'Prolongation',          scene: 'ot',     icon: 'clock' },
  { key: 'end-hdr',          label: 'Fin — en-tête',         scene: 'end',    icon: 'flag' },
  { key: 'end-logo-sq-blue', label: 'Fin — logo bleu',       scene: 'end',    icon: 'shield' },
  { key: 'end-logo-sq-orange', label: 'Fin — logo orange',   scene: 'end',    icon: 'shield' },
  { key: 'end-mid',          label: 'Fin — score',           scene: 'end',    icon: 'board' },
  { key: 'end-table',        label: 'Fin — tableau',         scene: 'end',    icon: 'list' },
  { key: 'end-bars',         label: 'Fin — barres',          scene: 'end',    icon: 'bar' },
  { key: 'end-media-banner', label: 'Fin — bandeau médias',  scene: 'end',    icon: 'image', optional: 'mb-on' },
  { key: 'win-content',      label: 'Victoire — contenu',    scene: 'win',    icon: 'trophy' },
  { key: 'win-label',        label: 'Victoire — titre',      scene: 'win',    icon: 'text' },
  { key: 'win-logo-wrap',    label: 'Victoire — logo',       scene: 'win',    icon: 'shield' },
  { key: 'win-team-name',    label: 'Victoire — nom',        scene: 'win',    icon: 'text' },
  { key: 'win-subtitle',     label: 'Victoire — sous-titre', scene: 'win',    icon: 'text' },
  { key: 'win-series-score', label: 'Victoire — score',      scene: 'win',    icon: 'pips' },
];
const EL = Object.fromEntries(ELEMENTS.map(e => [e.key, e]));
const elSel = E => E.sel || '#' + E.key;
const elNode = (doc, E) => (doc && E ? doc.querySelector(elSel(E)) : null);
const TEAM_OPTS = [['blue', 'Équipe bleue'], ['orange', 'Équipe orange'], ['scorer', 'Équipe qui marque'], ['winner', 'Équipe gagnante'], ['loser', 'Équipe perdante']];

const BUILTIN_THEMES = { rlcs: 'Default (RLCS)', neon: 'Néon', onyx: 'Onyx', nord: 'Nord', amber: 'Amber', rlcs2026: 'RLCS 2026', rlcs2023: 'RLCS 2023', vitality: 'Vitality', enisorail: 'Enisorail', rlcs2025: 'RLCS 2025', 'fifa-world-cup': 'FIFA WC' };

/* Polices Google (axes disponibles pour chaque famille) */
const FONTS = [
  { name: 'Barlow Condensed', loaded: true }, { name: 'Rajdhani', loaded: true },
  { name: 'Bebas Neue', axes: '' }, { name: 'Oswald', axes: 'wght@400;500;600;700' }, { name: 'Anton', axes: '' },
  { name: 'Teko', axes: 'wght@400;500;600;700' }, { name: 'Saira Condensed', axes: 'wght@400;600;700;800;900' },
  { name: 'Orbitron', axes: 'wght@400;600;700;800;900' }, { name: 'Russo One', axes: '' },
  { name: 'Chakra Petch', axes: 'ital,wght@0,400;0,600;0,700;1,700' }, { name: 'Exo 2', axes: 'ital,wght@0,400;0,600;0,800;0,900;1,800' },
  { name: 'Kanit', axes: 'ital,wght@0,400;0,600;0,800;0,900;1,800' }, { name: 'Montserrat', axes: 'ital,wght@0,400;0,600;0,800;0,900;1,800' },
  { name: 'Poppins', axes: 'ital,wght@0,400;0,600;0,800;0,900;1,800' }, { name: 'Archivo Black', axes: '' },
  { name: 'Bungee', axes: '' }, { name: 'Black Ops One', axes: '' }, { name: 'Audiowide', axes: '' },
  { name: 'Michroma', axes: '' }, { name: 'Permanent Marker', axes: '' }, { name: 'Bangers', axes: '' }, { name: 'Righteous', axes: '' },
];
const googleUrl = names => 'https://fonts.googleapis.com/css2?' + names.map(n => {
  const f = FONTS.find(x => x.name === n);
  return 'family=' + n.replace(/ /g, '+') + (f && f.axes ? ':' + f.axes : '');
}).join('&') + '&display=swap';
const fontStack = n => `'${String(n).replace(/'/g, '')}', 'Barlow Condensed', sans-serif`;

const PALETTES = [
  { name: 'Classique', v: { '--blue': '#1a5fff', '--blue-light': '#60a0ff', '--orange': '#d96000', '--orange-light': '#ff9c33', '--center-bg': '#0c0c14', '--panel-bg': 'rgba(244,244,250,0.97)', '--panel-text': '#0d0d1a' } },
  { name: 'Néon nuit', v: { '--blue': '#00e5ff', '--blue-light': '#7df9ff', '--orange': '#ff2bd6', '--orange-light': '#ff8af0', '--center-bg': '#05010f', '--panel-bg': 'rgba(10,6,28,0.96)', '--panel-text': '#eef3ff', '--row-bg': 'rgba(8,4,24,0.9)', '--stat-vals-bg': 'rgba(6,2,18,0.95)' } },
  { name: 'Or & noir', v: { '--blue': '#e8b84a', '--blue-light': '#ffd97a', '--orange': '#b0b6c2', '--orange-light': '#e6eaf0', '--center-bg': '#0a0806', '--panel-bg': 'rgba(16,13,8,0.96)', '--panel-text': '#f5e6c4', '--row-bg': 'rgba(14,11,6,0.9)' } },
  { name: 'Glace', v: { '--blue': '#3ab8ff', '--blue-light': '#a6e4ff', '--orange': '#7c5cff', '--orange-light': '#b9a6ff', '--center-bg': '#06111c', '--panel-bg': 'rgba(232,246,255,0.97)', '--panel-text': '#06243a' } },
  { name: 'Lave', v: { '--blue': '#ff5a1f', '--blue-light': '#ffb36b', '--orange': '#ffd000', '--orange-light': '#ffe873', '--center-bg': '#120403', '--panel-bg': 'rgba(24,6,4,0.95)', '--panel-text': '#ffe9dc', '--row-bg': 'rgba(20,6,4,0.9)' } },
  { name: 'Forêt', v: { '--blue': '#23c483', '--blue-light': '#7cf0bb', '--orange': '#f2b134', '--orange-light': '#ffd88a', '--center-bg': '#04110b', '--panel-bg': 'rgba(8,24,16,0.95)', '--panel-text': '#e6fff2', '--row-bg': 'rgba(6,20,13,0.9)' } },
  { name: 'Violet', v: { '--blue': '#8b5cf6', '--blue-light': '#c4b5fd', '--orange': '#f43f5e', '--orange-light': '#fda4af', '--center-bg': '#0d0718', '--panel-bg': 'rgba(20,12,36,0.95)', '--panel-text': '#f3eaff', '--row-bg': 'rgba(16,9,30,0.9)' } },
  { name: 'Mono', v: { '--blue': '#e5e7eb', '--blue-light': '#ffffff', '--orange': '#6b7280', '--orange-light': '#9ca3af', '--center-bg': '#0a0a0a', '--panel-bg': 'rgba(18,18,18,0.96)', '--panel-text': '#f5f5f5', '--row-bg': 'rgba(14,14,14,0.9)' } },
];

const VAR_GROUPS = [
  { t: 'Équipes', v: [['--blue', 'Bleu'], ['--blue-light', 'Bleu clair'], ['--orange', 'Orange'], ['--orange-light', 'Orange clair']] },
  { t: 'Scoreboard', v: [['--center-bg', 'Centre (score)'], ['--panel-bg', 'Panneaux équipes'], ['--panel-text', 'Texte des panneaux'], ['--dot-bg', 'Pastilles de série']] },
  { t: 'Sidebars & stat bar', v: [['--row-bg', 'Lignes joueurs'], ['--stat-vals-bg', 'Fond des stats']] },
  { t: 'But & replay', v: [['--goal-bg', 'Fond notif but'], ['--replay-bg', 'Barre de replay'], ['--replay-text', 'Texte du replay'], ['--wipe-bg', 'Fond transition'], ['--wipe-box-bg', 'Boîte transition']] },
  { t: 'Fin & victoire', v: [['--end-bg', 'Fond de fin'], ['--end-mid-bg', 'Centre de fin'], ['--end-tbl-bg', 'Tableau de fin'], ['--win-bg', 'Fond victoire']] },
];
const SIZE_VARS = [
  ['--goal-word-size', 'Mot GOAL', 'px', 30, 220, 1], ['--goal-sub-size', 'Sous-titre but', 'px', 10, 60, 1],
  ['--replay-bar-h', 'Hauteur replay', 'px', 40, 160, 1], ['--replay-label-size', 'Texte REPLAY', 'px', 12, 70, 1],
  ['--replay-scorer-size', 'Nom du buteur', 'px', 12, 70, 1], ['--replay-spd-size', 'Vitesse balle', 'px', 12, 70, 1],
  ['--wipe-word-size', 'Mot transition', 'px', 60, 320, 1], ['--wipe-duration', 'Durée transition', 's', 1, 8, .1],
  ['--win-logo-sz', 'Logo victoire', 'px', 60, 320, 1], ['--win-team-size', 'Nom victoire', 'px', 30, 180, 1],
];

const IN_ANIMS = [['none', 'Aucune'], ['fade', 'Fondu'], ['slide-left', 'Glisse depuis la gauche'], ['slide-right', 'Glisse depuis la droite'], ['slide-up', 'Monte depuis le bas'], ['slide-down', 'Descend du haut'],
  ['zoom', 'Zoom'], ['pop', 'Pop'], ['drop', 'Chute avec rebond'], ['spin', 'Tourbillon'], ['flip', 'Retournement'], ['flip-x', 'Bascule'], ['blur', 'Flou → net'],
  ['wipe', 'Balayage →'], ['wipe-up', 'Balayage ↑'], ['wipe-center', 'Ouverture centrale'], ['stretch', 'Étirement'], ['glitch', 'Glitch']];
const LOOP_ANIMS = [['none', 'Aucune'], ['pulse', 'Pulsation'], ['heartbeat', 'Battement'], ['float', 'Flottement'], ['swing', 'Balancement'], ['spin', 'Rotation continue'],
  ['blink', 'Clignotement'], ['shake', 'Tremblement'], ['glow', 'Lueur'], ['breathe', 'Respiration'], ['wobble', 'Ondulation'], ['shine', 'Reflet brillant']];
const EL_LOOPS = [['none', 'Aucune'], ['pulse', 'Pulsation'], ['heartbeat', 'Battement'], ['float', 'Flottement'], ['swing', 'Balancement'], ['glow', 'Lueur']];
const OUT_ANIMS = [['none', 'Instantanée'], ['fade', 'Fondu'], ['slide-left', 'Glisse vers la gauche'], ['slide-right', 'Glisse vers la droite'], ['slide-up', 'Monte'], ['slide-down', 'Descend'], ['zoom', 'Zoom arrière'], ['blur', 'Flou'], ['wipe', 'Balayage']];
const EASES = { smooth: 'cubic-bezier(.22,1,.36,1)', out: 'ease-out', inout: 'ease-in-out', linear: 'linear', back: 'cubic-bezier(.34,1.56,.64,1)', in: 'ease-in' };
const EASE_OPTS = [['smooth', 'Douce'], ['out', 'Décélération'], ['inout', 'Accélère puis ralentit'], ['back', 'Rebond'], ['linear', 'Linéaire'], ['in', 'Accélération']];
const SHOW_OPTS = [['always', 'Toujours'], ['game', 'En jeu'], ['goal', 'Pendant un but'], ['replay', 'Pendant le replay'], ['ot', 'Prolongation'], ['end', 'Écran de fin'], ['win', 'Victoire de la série']];
/* Moments où un calque s'affiche (plusieurs possibles) — « En jeu » = jeu en cours hors but / replay */
const MOMENTS = [['always', 'Toujours'], ['game', 'En jeu'], ['goal', 'But'], ['wreplay', 'Anim. REPLAY'], ['replay', 'Replay'], ['wlive', 'Anim. LIVE'], ['ot', 'Prolongation'], ['end', 'Fin de match'], ['win', 'Victoire']];
const MOMENT_SHORT = { game: 'Jeu', goal: 'But', wreplay: 'Anim. R', replay: 'Replay', wlive: 'Anim. L', ot: 'Prol.', end: 'Fin', win: 'Victoire' };
const DEFAULT_SHOW = ['game', 'goal', 'replay'];
/* ancien format (texte) → liste ; « game » voulait dire tout le temps pendant le jeu */
const showList = L => Array.isArray(L.show) ? L.show : !L.show || L.show === 'always' ? ['always'] : L.show === 'game' ? [...DEFAULT_SHOW] : [L.show];
/* moments d'un dossier : null = aucune restriction (Toujours) */
const groupShow = g => (g && Array.isArray(g.show) && g.show.length && !g.show.includes('always')) ? g.show : null;
const SHOW_SCENE = { always: null, game: 'game', goal: 'goal', wreplay: 'wreplay', replay: 'replay', wlive: 'wlive', ot: 'ot', end: 'end', win: 'win' };
const TOKENS = [['blue_name', 'Équipe bleue'], ['orange_name', 'Équipe orange'], ['blue_score', 'Score bleu'], ['orange_score', 'Score orange'], ['timer', 'Chrono'],
  ['league', 'Ligue'], ['bo', 'GAME X - BOX'], ['game', 'N° de la game'], ['bo_num', 'Best of (nombre)'], ['series_blue', 'Série bleue'], ['series_orange', 'Série orange'],
  ['player', 'Joueur suivi'], ['boost', 'Boost'], ['goals', 'Buts (stat bar)'], ['assists', 'Passes D (stat bar)'], ['shots', 'Tirs (stat bar)'], ['saves', 'Arrêts (stat bar)'], ['demos', 'Démos (stat bar)'],
  ['scorer', 'Buteur (but / replay)'], ['assist', 'Passeur (replay, vide sans passe)'], ['scorer_team', 'Équipe du buteur'], ['speed', 'Vitesse du tir (replay)'],
  ['winner', 'Équipe gagnante (fin / victoire)'], ['loser', 'Équipe perdante (fin / victoire)'], ['mvp', 'MVP du match (fin)'], ['mvp_score', 'Score du MVP (fin)'], ['mvp_team', 'Équipe du MVP (fin)']];
const SHAPES = [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['parallelogram', 'Parallélogramme'], ['trapezoid', 'Trapèze'], ['trapezoid-inv', 'Trapèze inversé'], ['slant', 'Biseau'],
  ['chevron', 'Chevron'], ['hexagon', 'Hexagone'], ['diamond', 'Losange'], ['triangle', 'Triangle']];
const CLIPS = {
  parallelogram: 'polygon(12% 0,100% 0,88% 100%,0 100%)', trapezoid: 'polygon(8% 0,92% 0,100% 100%,0 100%)', 'trapezoid-inv': 'polygon(0 0,100% 0,92% 100%,8% 100%)',
  slant: 'polygon(0 0,100% 0,100% 100%,7% 100%)', chevron: 'polygon(0 0,85% 0,100% 50%,85% 100%,0 100%,15% 50%)',
  hexagon: 'polygon(10% 0,90% 0,100% 50%,90% 100%,10% 100%,0 50%)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', triangle: 'polygon(50% 0,100% 100%,0 100%)',
};
const BLENDS = [['normal', 'Normal'], ['screen', 'Superposition claire'], ['lighten', 'Éclaircir'], ['multiply', 'Produit'], ['overlay', 'Incrustation'], ['color-dodge', 'Densité couleur −'], ['difference', 'Différence']];

/* ─────────────────────────── Projet & état ─────────────────────────── */
function newProject() {
  return {
    format: 'rlo-studio', version: 1, id: 'p' + Date.now().toString(36) + uid(),
    name: 'Mon thème', themeId: '', base: 'rlcs',
    vars: {}, font: null, fonts: [], elements: {}, layers: [], assets: {},
    sidebar: { link: true, blue: {}, orange: {} },
    transitions: {}, endBg: null, options: { timerShort: false }, end: {}, win: {},
    importedCss: '', importedAnims: [], customCss: '', guides: { v: [], h: [] },
  };
}
function normalize(p) {
  const n = Object.assign(newProject(), p || {});
  n.vars ||= {}; n.fonts ||= []; n.elements ||= {}; n.layers ||= []; n.assets ||= {};
  n.sidebar ||= { link: true, blue: {}, orange: {} }; n.sidebar.blue ||= {}; n.sidebar.orange ||= {};
  n.transitions ||= {}; n.options ||= {}; n.guides ||= { v: [], h: [] }; n.guides.v ||= []; n.guides.h ||= [];
  n.importedAnims ||= []; n.end ||= {}; n.win ||= {};
  n.layers.forEach(L => { if (!isGroup(L)) { L.anim ||= {}; L.show = showList(L); } });
  return n;
}

const S = {
  p: newProject(), sel: null, scene: 'game',
  zoom: .5, panX: 0, panY: 0, autoFit: true,
  snap: true, grid: false, rulers: true, bg: 'stadium', tab: 'props',
  base: { id: null, css: '', meta: {}, previewCss: '' },
  themes: [], frameOk: false, boxes: new Map(), drag: null, space: false, clip: null,
  fields: [], kfSel: 0, forced: null,
};
const sceneElements = () => ELEMENTS.filter(E => sceneShowsElement(E));
const elData = key => (S.p.elements[key] ||= {});
const layerById = id => S.p.layers.find(L => L.id === id);
const fileOf = id => (id && S.p.assets[id] && S.p.assets[id].file) || null;

/* Dossiers (comme Photoshop) : une entrée { type:'group' } dans la liste des calques, suivie de ses
   calques (L.group = id du dossier) — toujours contigus, remis en ordre par normalizeGroups(). */
const isGroup = x => !!x && x.type === 'group';
const realLayers = () => S.p.layers.filter(x => !isGroup(x));
const groupById = id => S.p.layers.find(g => isGroup(g) && g.id === id) || null;
const groupOf = L => (L && L.group ? groupById(L.group) : null);
const membersOf = gid => S.p.layers.filter(L => !isGroup(L) && L.group === gid);
const effHidden = L => !!(L && (L.hidden || (groupOf(L) || {}).hidden));
const effLocked = L => !!(L && (L.locked || (groupOf(L) || {}).locked));
function normalizeGroups() {
  const arr = S.p.layers, out = [];
  const gids = new Set(arr.filter(isGroup).map(g => g.id));
  for (const x of arr) {
    if (isGroup(x)) out.push(x, ...arr.filter(L => !isGroup(L) && L.group === x.id));
    else if (!x.group || !gids.has(x.group)) { delete x.group; out.push(x); }
  }
  S.p.layers = out;
}
const blockOf = x => isGroup(x) ? [x, ...membersOf(x.id)] : [x];
/* Nouveau calque : dans le dossier sélectionné (ou celui du calque sélectionné), sinon tout en haut */
function insertLayer(L) {
  const sel = S.sel && layerById(S.sel.id);
  delete L.group;
  if (sel && isGroup(sel)) { L.group = sel.id; S.p.layers.splice(S.p.layers.indexOf(sel) + 1, 0, L); }
  else if (sel && sel.group) { L.group = sel.group; S.p.layers.splice(S.p.layers.indexOf(sel), 0, L); }
  else S.p.layers.unshift(L);
  normalizeGroups();
}

/* ─────────────────────────── Aperçu (iframe) ─────────────────────────── */
const frame = $('#frame');
const F = () => { try { return frame.contentWindow && frame.contentWindow.__studio || null; } catch (e) { return null; } };
const FD = () => { try { return frame.contentDocument; } catch (e) { return null; } };

const previewCtx = { sel: 'body[data-theme="rlo-studio"]', url: f => `/studio-work/${f}`, install: false };
const installCtx = { sel: 'body[data-theme="__THEME__"]', url: f => `/themes/__THEME__/${f}`, install: true };

function processBaseCss(raw, themeId, folder, base) {
  let css = raw || '';
  const imports = [];
  css = css.replace(/@charset[^;]+;/g, '');
  css = css.replace(/@import\s+[^;]+;/g, m => { imports.push(m); return ''; });
  css = css.replace(/\[data-theme=(["'])[^"']*\1\]/g, `[data-theme="${themeId}"]`);
  if (base && base !== 'rlcs' && folder !== base) {
    const b = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    css = css.replace(new RegExp(`/themes/${b}/`, 'g'), `/themes/${folder}/`);
  }
  css = css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/|#|about:)([^'")]+)\1\s*\)/g, (m, q, u) => `url(${q}/themes/${folder}/${u}${q})`);
  return { imports, css };
}

function animName(v, kind) { return String(v).startsWith('imp:') ? String(v).slice(4) : `st-${kind}-${v}`; }

function elFilter(d) {
  const f = [];
  if (d.hue) f.push(`hue-rotate(${round(d.hue)}deg)`);
  if (d.sat != null && d.sat !== 100) f.push(`saturate(${round(d.sat)}%)`);
  if (d.bright != null && d.bright !== 100) f.push(`brightness(${round(d.bright)}%)`);
  if (d.o != null && d.o !== 100) f.push(`opacity(${round(d.o)}%)`);
  if (d.glow && d.glow.size > 0) f.push(`drop-shadow(0 0 ${round(d.glow.size)}px ${d.glow.color || '#ffffff'})`);
  return f.join(' ');
}
function elementCss(E, d, sel) {
  const s = `html ${sel} ${elSel(E)}`, r = [];
  const x = d.x || 0, y = d.y || 0, sc = d.s ?? 1, rot = d.r || 0;
  if (x || y) r.push(`translate:${round(x, 1)}px ${round(y, 1)}px`);
  if (sc !== 1) r.push(`scale:${round(sc, 4)}`);
  if (rot) r.push(`rotate:${round(rot, 2)}deg`);
  if (sc !== 1 || rot) r.push('transform-origin:center center');
  const filt = elFilter(d);
  if (filt) r.push(`filter:${filt}`);
  if (d.hidden) r.push('visibility:hidden !important');
  let css = r.length ? `${s} { ${r.join('; ')}; }` : '';
  if (d.font) css += `\n${s}, ${s} * { font-family:${fontStack(d.font)} !important; }`;
  /* masqué pendant certains moments (classes st-m-… posées sur <html> par le moteur) */
  for (const m of d.hideIn || []) css += `\nhtml.st-m-${m} ${sel} ${elSel(E)} { opacity:0 !important; pointer-events:none !important; }`;
  if (E.key === 'goal-notif' && d.goal) css += '\n' + goalCss(`html ${sel} #goal-notif`, d.goal);
  if (E.key === 'stat-bar' && d.stb) css += '\n' + statBarCss(`html ${sel} #stat-bar`, d.stb);
  if (E.key === 'boost-meter' && d.bmt) css += '\n' + boostMeterCss(`html ${sel} #boost-meter`, d.bmt);
  if ((E.key === 'media-banner' || E.key === 'end-media-banner') && d.mb) {
    const m = d.mb;
    if (m.w || m.h) css += `\n${s} { ${m.w ? `width:${m.w}px !important;` : ''} ${m.h ? `height:${m.h}px !important;` : ''} }`;
    css += '\n' + mediaCss(`html ${sel}`, m, '#' + E.key);
  }
  const lp = d.loop && d.loop.name && d.loop.name !== 'none' ? d.loop : null;
  if (lp) {
    const n = `st-el-${E.key}`, dur = lp.dur || 2;
    css += `\n${s} { animation:${n} ${dur}s ease-in-out infinite; }\n`;
    const S1 = round(sc, 4);
    if (lp.name === 'pulse') css += `@keyframes ${n} { 0%,100% { scale:${S1}; } 50% { scale:${round(sc * 1.05, 4)}; } }`;
    else if (lp.name === 'heartbeat') css += `@keyframes ${n} { 0%,30%,60%,100% { scale:${S1}; } 15% { scale:${round(sc * 1.1, 4)}; } 45% { scale:${round(sc * 1.06, 4)}; } }`;
    else if (lp.name === 'float') css += `@keyframes ${n} { 0%,100% { translate:${round(x, 1)}px ${round(y, 1)}px; } 50% { translate:${round(x, 1)}px ${round(y - 10, 1)}px; } }`;
    else if (lp.name === 'swing') css += `@keyframes ${n} { 0%,100% { rotate:${round(rot - 3, 2)}deg; } 50% { rotate:${round(rot + 3, 2)}deg; } }`;
    else if (lp.name === 'glow') {
      const c = lp.color || '#ffffff';
      css += `@keyframes ${n} { 0%,100% { filter:${filt} drop-shadow(0 0 1px ${c}); } 50% { filter:${filt} drop-shadow(0 0 ${lp.size || 20}px ${c}); } }`;
    }
  }
  return css;
}

function textCss(L, s) {
  const t = L.text || {};
  const align = t.align || 'center';
  const p = [`font-family:${fontStack(t.font || 'Barlow Condensed')}`, `font-size:${t.size || 48}px`, `font-weight:${t.weight || 800}`,
    `letter-spacing:${t.spacing || 0}px`, `justify-content:${{ left: 'flex-start', center: 'center', right: 'flex-end' }[align]}`, `text-align:${align}`];
  if (t.upper) p.push('text-transform:uppercase');
  if (t.italic) p.push('font-style:italic');
  if (t.glow && t.glow.size > 0) p.push(`filter:drop-shadow(0 0 ${t.glow.size}px ${t.glow.color || '#ffffff'})`);
  const sp = [];
  if (t.grad && t.grad.on) sp.push(`background:linear-gradient(${t.grad.angle ?? 90}deg, ${t.color || '#ffffff'}, ${t.grad.color2 || '#7aa8ff'})`, '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
  else sp.push(`color:${t.color || '#ffffff'}`);
  if (t.stroke && t.stroke.w > 0) sp.push(`-webkit-text-stroke:${t.stroke.w}px ${t.stroke.color || '#000000'}`, 'paint-order:stroke fill');
  return `${s} .st-text { ${p.join('; ')}; }\n${s} .st-text span { ${sp.join('; ')}; }`;
}
/* Points du polygone (en %) : forme libre déformée (Ctrl + coin) ou forme prédéfinie ; null = rectangle / ellipse */
const SIDES = ['t', 'r', 'b', 'l'];
function polyPts(sh) {
  if (sh.kind === 'custom' && Array.isArray(sh.pts) && sh.pts.length >= 3) return sh.pts;
  const c = CLIPS[sh.kind];
  return c ? c.replace(/^polygon\(|\)$/g, '').split(',').map(q => q.trim().split(/\s+/).map(v => parseFloat(v) || 0)) : null;
}
/* côté auquel appartient une arête (haut / droite / bas / gauche), d'après son milieu */
function edgeSide(a, b) {
  const mx = (a[0] + b[0]) / 2 - 50, my = (a[1] + b[1]) / 2 - 50;
  return Math.abs(my) >= Math.abs(mx) ? (my < 0 ? 't' : 'b') : (mx < 0 ? 'l' : 'r');
}
function shapeCss(L, s) {
  const sh = L.shape || {}, kind = sh.kind || 'rect', pts = polyPts(sh);
  const p = ['position:relative', 'overflow:hidden', 'box-sizing:border-box'];
  const fillImg = sh.grad && sh.grad.on ? `linear-gradient(${sh.grad.angle ?? 135}deg, ${sh.fill || '#3d7bff'}, ${sh.grad.color2 || '#9b5cff'})` : null;
  const bd = sh.border || {}, bw = +bd.w || 0, bc = bd.color || '#ffffff', sides = bd.sides || { t: 1, r: 1, b: 1, l: 1 };
  const imgs = [];
  if (pts) {
    p.push(`clip-path:polygon(${pts.map(q => `${round(q[0], 2)}% ${round(q[1], 2)}%`).join(',')})`);
    /* bordure d'un polygone : arêtes tracées en SVG (2× l'épaisseur, la moitié extérieure est rognée) */
    if (bw > 0) {
      const lines = pts.map((a, i) => {
        const b = pts[(i + 1) % pts.length];
        return sides[edgeSide(a, b)] ? `<line x1='${a[0]}' y1='${a[1]}' x2='${b[0]}' y2='${b[1]}' stroke='${bc}' stroke-width='${bw * 2}' stroke-linecap='square' vector-effect='non-scaling-stroke'/>` : '';
      }).join('');
      if (lines) imgs.push(`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${lines}</svg>`)}")`);
    }
  } else {
    if (kind === 'ellipse') p.push('border-radius:50%');
    else if (sh.radii) p.push(`border-radius:${sh.radii.map(v => `${Math.max(0, +v || 0)}px`).join(' ')}`);
    else if (sh.radius) p.push(`border-radius:${sh.radius}px`);
    if (bw > 0) p.push('border-style:solid', `border-color:${bc}`, `border-width:${SIDES.map(k => sides[k] ? bw + 'px' : '0').join(' ')}`);
  }
  if (fillImg) imgs.push(fillImg);
  if (imgs.length) p.push(`background-image:${imgs.join(', ')}`, 'background-size:100% 100%', 'background-repeat:no-repeat');
  if (!fillImg) p.push(`background-color:${sh.fill || '#3d7bff'}`);
  if (sh.skx || sh.sky) p.push(`transform:skew(${round(sh.skx || 0, 2)}deg, ${round(sh.sky || 0, 2)}deg)`);
  let css = `${s} .st-shape { ${p.join('; ')}; }`;
  if (sh.glow && sh.glow.size > 0) css += `\n${s} .st-loop { filter:drop-shadow(0 0 ${sh.glow.size}px ${sh.glow.color || '#3d7bff'}); }`;
  return css;
}
function shineCss(L, s, a, ctx, delay) {
  const dur = a.loopDur ?? 2.4;
  const anim = `st-shine ${dur}s ease-in-out ${delay}s infinite`;
  if (L.type === 'text') {
    const t = L.text || {}, c1 = t.color || '#ffffff', c2 = t.grad && t.grad.on ? (t.grad.color2 || c1) : c1;
    return `${s}.st-on .st-text span { background:linear-gradient(105deg, ${c1} 0 38%, #ffffff 50%, ${c2} 62% 100%); background-size:250% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; animation:${anim}; }`;
  }
  const band = `content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(105deg, transparent 38%, rgba(255,255,255,.7) 50%, transparent 62%); background-size:250% 100%; animation:${anim};`;
  if (L.type === 'shape') return `${s}.st-on .st-shape::after { ${band} }`;
  let mask = '';
  const file = fileOf(L.asset);
  if (L.type === 'image' && file) {
    const size = { contain: 'contain', cover: 'cover', fill: '100% 100%' }[L.fit || 'contain'];
    mask = ` -webkit-mask:url('${ctx.url(file)}') center/${size} no-repeat; mask:url('${ctx.url(file)}') center/${size} no-repeat;`;
  }
  return `${s}.st-on .st-c::after { ${band}${mask} }`;
}
function kfCss(n, keys) {
  const ks = [...keys].sort((a, b) => a.t - b.t);
  return `@keyframes ${n} { ${ks.map(k => `${round(k.t, 1)}% { transform:translate(${round(k.x, 1)}px, ${round(k.y, 1)}px) scale(${round((k.s ?? 100) / 100, 3)}) rotate(${round(k.r, 1)}deg); opacity:${round((k.o ?? 100) / 100, 3)}; }`).join(' ')} }`;
}
function layerCss(L, sel, ctx) {
  const s = `${sel} .st-layer[data-l="${L.id}"]`, a = L.anim || {}, out = [];
  const g = groupOf(L), op = (L.o ?? 100) / 100 * ((g && g.o) ?? 100) / 100;
  const base = [`left:${round(L.x, 1)}px`, `top:${round(L.y, 1)}px`, `width:${round(L.w, 1)}px`, `height:${round(L.h, 1)}px`,
    `--st-o:${round(op, 3)}`, `--st-out:${a.out === 'none' ? 0 : (a.outDur ?? .35)}s`];
  if (L.r) base.push(`rotate:${round(L.r, 2)}deg`);
  if (L.blend && L.blend !== 'normal') base.push(`mix-blend-mode:${L.blend}`);
  if (L.shadow && L.shadow.on) base.push(`filter:drop-shadow(${L.shadow.x || 0}px ${L.shadow.y || 0}px ${L.shadow.blur || 0}px ${L.shadow.color || 'rgba(0,0,0,0.6)'})`);
  out.push(`${s} { ${base.join('; ')}; }`);
  const hasIn = a.in && a.in !== 'none';
  const inDur = a.inDur ?? .6, inDelay = a.inDelay ?? 0, after = hasIn ? round(inDur + inDelay, 3) : 0;
  if (hasIn) out.push(`${s}.st-on > .st-anim { animation:${animName(a.in, 'in')} ${inDur}s ${EASES[a.inEase || 'smooth']} ${inDelay}s both; }`);
  if (a.loop && a.loop !== 'none') {
    if (a.loop === 'shine') out.push(shineCss(L, s, a, ctx, after));
    else out.push(`${s}.st-on .st-loop { animation:${animName(a.loop, 'loop')} ${a.loopDur ?? 2}s ${a.loop === 'spin' ? 'linear' : 'ease-in-out'} ${after}s infinite;${a.loop === 'glow' ? ` --st-glow:${a.glowColor || '#ffffff'};` : ''} }`);
  }
  const kf = a.kf;
  if (kf && kf.on && kf.keys && kf.keys.length >= 2) {
    const n = `st-kf-${L.id}`;
    out.push(`${s}.st-on .st-kf { animation:${n} ${kf.dur || 2}s ${EASES[kf.ease || 'inout']} ${round((kf.delay || 0) + after, 3)}s ${kf.iter === 'inf' ? 'infinite' : (kf.iter || 1)} ${kf.alt ? 'alternate' : 'normal'} both; }`);
    out.push(kfCss(n, kf.keys));
  }
  if (L.type === 'image' || L.type === 'video' || L.type === 'logo') out.push(`${s} .st-c > img, ${s} .st-c > video { object-fit:${L.fit || 'contain'}; }`);
  if (L.flipX || L.flipY) out.push(`${s} .st-c { transform:scale(${L.flipX ? -1 : 1}, ${L.flipY ? -1 : 1}); }`);
  if (L.type === 'text') out.push(textCss(L, s));
  if (L.type === 'shape') out.push(shapeCss(L, s));
  if (L.type === 'media') out.push(mediaCss(s, L.media || {}, '.st-media'));
  if (L.type === 'series') out.push(seriesCss(L, s));
  if (L.type === 'boost') out.push(boostCss(L, s));
  return out.join('\n');
}
/* Série : couleur « gagnée » = couleur de l'équipe sauf couleur choisie */
function seriesCss(L, s) {
  const r = L.series || {};
  const on = r.on || (r.team === 'orange' ? 'var(--orange)' : 'var(--blue)');
  let css = `${s} .st-series { --st-on:${on}; --st-off:${r.off ?? 'rgba(255,255,255,0.16)'}; --st-gap:${r.gap ?? 6}px; --st-r:${r.radius ?? 3}px; --st-bw:${r.bw ?? 8}px; }`;
  const inset = r.borderW ? `inset 0 0 0 ${r.borderW}px ${r.borderC || '#ffffff'}` : '';
  if (inset) css += `\n${s} .st-series > i { box-shadow:${inset}; }`;
  if (r.glow) css += `\n${s} .st-series > i.on { box-shadow:0 0 ${r.glow}px var(--st-on)${inset ? ', ' + inset : ''}; }`;
  if (r.style === 'text') css += `\n${s} .st-series > span { font-family:${fontStack(r.font || 'Barlow Condensed')}; font-size:${r.size || 48}px; font-weight:${r.weight || 900}; color:${r.color || 'var(--st-on)'};${r.glow ? ` text-shadow:0 0 ${r.glow}px var(--st-on);` : ''} }`;
  return css;
}
/* Orientation d'une jauge circulaire (SVG dont le cercle part de 3 h dans le sens horaire).
   full : cercle complet, open = point de départ (0 = en haut) ; sinon arc de « sweep » degrés,
   open = milieu de l'ouverture (0 = en bas, 90 = à gauche, 180 = en haut, 270 = à droite).
   ccw : remplissage dans le sens inverse (miroir). */
function arcTransform(full, open, sweep, ccw) {
  const o = +open || 0;
  let start;
  if (full) start = -90 + o;
  else { const gapC = 90 + o, gap = 360 - (sweep || 270); start = ccw ? gapC - gap / 2 : gapC + gap / 2; }
  return `rotate(${round(start, 2)}deg)${ccw ? ' scale(1, -1)' : ''}`;
}
const ARC_OPEN = [[0, 'Bas'], [90, 'Gauche'], [180, 'Haut'], [270, 'Droite']];
const ARC_START = [[0, 'Haut'], [90, 'Droite'], [180, 'Bas'], [270, 'Gauche']];
const ARC_CAPS = [['round', 'Arrondis'], ['butt', 'Plats'], ['square', 'Carrés (dépassent un peu)']];
/* Réglages communs des jauges en cercle / arc : longueur, ouverture (ou départ), sens, bouts */
function arcControls(get, set, o = {}) {
  const full = !!o.full, open = () => +get('open') || 0;
  return [
    full ? null : row('Longueur de l\'arc', slider(() => get('sweep') ?? 270, v => set('sweep', v), { min: 90, max: 350, step: 5, unit: '°', level: o.sweepLevel || 'layers' })),
    h('div', { class: 'lbl', style: 'width:auto;margin:4px 0 6px' }, full ? 'Départ du remplissage' : 'Position de l\'ouverture'),
    chipToggles((full ? ARC_START : ARC_OPEN).map(([v, l]) => [String(v), l]), k => open() === +k, k => { set('open', +k || null); changed('css', { commit: 'now' }); }),
    row('Angle', slider(open, v => set('open', v || null), { min: 0, max: 359, unit: '°' })),
    row('Sens', selectField([['cw', 'Horaire'], ['ccw', 'Anti-horaire']], () => (get('ccw') ? 'ccw' : 'cw'), v => set('ccw', v === 'ccw' ? true : null))),
    row('Bouts de la ligne', selectField(ARC_CAPS, () => get('cap') || 'round', v => set('cap', v === 'round' ? null : v))),
  ];
}
/* Jauge de boost : couleur = équipe du joueur suivi sauf couleur choisie */
function boostCss(L, s) {
  const b = L.boost || {}, v = [];
  if (b.fill) v.push(`--st-fill:${b.fill}`);
  if (b.cap) v.push(`--st-cap:${b.cap}`);
  v.push(`--st-track:${b.track ?? 'rgba(255,255,255,0.14)'}`, `--st-bw:${b.bw ?? 9}`, `--st-r:${b.radius ?? 8}px`, `--st-gap:${b.gap ?? 4}px`,
    `--st-num-size:${b.numSize ?? 40}px`, `--st-num-color:${b.numColor || '#ffffff'}`, `--st-num-font:'${String(b.font || 'Barlow Condensed').replace(/'/g, '')}'`);
  let css = `${s} .st-boost { ${v.join('; ')}; }`;
  if (b.bg) css += `\n${s} .st-boost { background:${b.bg}; border-radius:${['ring', 'arc'].includes(b.style) ? '50%' : `${b.radius ?? 8}px`}; }`;
  if (b.glow) css += `\n${s} .st-b-arc, ${s} .st-b-fill, ${s} .st-b-segs > i.on { filter:drop-shadow(0 0 ${b.glow}px var(--st-fill, var(--st-team))); }`;
  if ((b.style === 'ring' || b.style === 'arc') && (b.open || b.ccw || (b.style === 'arc' && b.sweep)))
    css += `\n${s} .st-boost svg { transform:${arcTransform(b.style === 'ring', b.open, b.sweep, b.ccw)}; }`;
  return css;
}
/* Annonce de but : fond, mot (police, taille, couleur, contour, lueur), sous-texte, animations */
function goalCss(R, g) {
  const r = [], add = (sub, p) => r.push(`${R}${sub} { ${p} }`);
  if (g.bg) add(' #goal-inner', `background:${g.bg} !important;`);
  if (g.radius != null) add(' #goal-inner', `border-radius:${g.radius}px !important;`);
  if (g.borderW) add(' #goal-inner', `border:${g.borderW}px solid ${g.borderC || '#ffffff'} !important;`);
  if (g.padX != null || g.padY != null) add(' #goal-inner', `padding:${g.padY ?? 20}px ${g.padX ?? 70}px !important;`);
  if (g.noShine) add(' #goal-inner::after', 'display:none !important;');
  if (g.font) add(' #goal-word', `font-family:${fontStack(g.font)} !important;`), add(' #goal-sub', `font-family:${fontStack(g.font)} !important;`);
  if (g.size) add(' #goal-word', `font-size:${g.size}px !important;`);
  if (g.color) add(' #goal-word', `color:${g.color} !important; -webkit-text-fill-color:${g.color} !important; background:none !important;`);
  if (g.spacing != null) add(' #goal-word', `letter-spacing:${g.spacing}px !important;`);
  if (g.italic) add(' #goal-word', 'font-style:italic !important;');
  if (g.stroke) add(' #goal-word', `-webkit-text-stroke:${g.stroke}px ${g.strokeC || '#000000'} !important; paint-order:stroke fill;`);
  if (g.glow) add(' #goal-word', `text-shadow:0 0 ${g.glow}px ${g.glowC || 'currentColor'} !important;`);
  if (g.subSize) add(' #goal-sub', `font-size:${g.subSize}px !important;`);
  if (g.subColor) add(' #goal-sub', `color:${g.subColor} !important;`);
  const inDur = g.inDur ?? .6;
  if (g.inAnim && g.inAnim !== 'none') add('.show #goal-inner', `animation:${animName(g.inAnim, 'in')} ${inDur}s ${EASES[g.inEase || 'back']} both !important;`);
  if (g.wordLoop && g.wordLoop !== 'none') add('.show #goal-word', `animation:${animName(g.wordLoop, 'loop')} ${g.loopDur ?? 1.2}s ${g.wordLoop === 'spin' ? 'linear' : 'ease-in-out'} ${g.inAnim && g.inAnim !== 'none' ? inDur : .2}s infinite !important; --st-glow:${g.glowC || '#ffffff'};`);
  return r.join('\n');
}
/* options lues par le moteur (texte du mot, buteur, préfixe, durée) */
function goalRuntimeOpts() {
  const g = (S.p.elements['goal-notif'] || {}).goal || {};
  const o = {};
  if (g.text) o.text = g.text;
  if (g.scorer === false) o.scorer = false;
  if (g.prefix != null) o.prefix = g.prefix;
  if (g.dur) o.dur = g.dur;
  return Object.keys(o).length ? o : null;
}

/* Stat bar (joueur suivi) : tailles, couleurs, stats affichées */
const STAT_KEYS = [['goals', 'Buts'], ['assists', 'Passes D'], ['shots', 'Tirs'], ['saves', 'Arrêts'], ['demos', 'Démos']];
function statBarCss(R, m) {
  const r = [], add = (sub, p) => r.push(`${R}${sub} { ${p} }`);
  if (m.h != null) add('', `height:${m.h}px !important;`);
  if (m.w != null) add('', `width:${m.w}px !important;`);
  if (m.radius != null) add('', `border-radius:${m.radius}px !important;`);
  if (m.tagW != null) add(' #stat-team-tag', `min-width:${m.tagW}px !important;`);
  if (m.tagBg) add(' #stat-team-tag', `background:${m.tagBg} !important;`);
  if (m.valsBg) add(' #stat-values', `background:${m.valsBg} !important;`);
  if (m.nameSize != null) add(' #stat-player-name', `font-size:${m.nameSize}px !important;`);
  if (m.nameColor) add(' #stat-player-name', `color:${m.nameColor} !important;`);
  if (m.valSize != null) add(' .stat-val', `font-size:${m.valSize}px !important;`);
  if (m.valColor) add(' .stat-val', `color:${m.valColor} !important;`);
  if (m.lblSize != null) add(' .stat-lbl', `font-size:${m.lblSize}px !important;`);
  if (m.lblColor) add(' .stat-lbl', `color:${m.lblColor} !important;`);
  if (m.hideLbl) add(' .stat-lbl', 'display:none !important;');
  if (m.hideArrows) add(' #stat-arrows', 'display:none !important;');
  if (m.noSep) add(' .stat-item', 'border-right:none !important;');
  (m.hide || []).forEach(k => { const i = STAT_KEYS.findIndex(x => x[0] === k); if (i >= 0) add(` .stat-item:nth-child(${i + 1})`, 'display:none !important;'); });
  return r.join('\n');
}
/* Boost meter d'origine : fond, forme, anneau, piste, graduations, chiffre, vitesse */
function boostMeterCss(R, m) {
  const r = [], add = (sub, p) => r.push(`${R}${sub} { ${p} }`);
  if (m.bg) add('', `background:${m.bg} !important;`);
  if (m.shape === 'square') add('', `border-radius:${m.sqRadius ?? 28}px !important;`);
  if (m.shape === 'none') add('', 'background:transparent !important;');
  if (m.ring) add(' #boost-arc', `stroke:${m.ring} !important;`);
  if (m.track) add(' #boost-track', `stroke:${m.track} !important;`);
  if (m.trackFill) add(' #boost-track', `fill:${m.trackFill} !important;`);
  if (m.width != null) add(' #boost-arc', `stroke-width:${m.width} !important;`), add(' #boost-track', `stroke-width:${m.width} !important;`);
  if (m.ticks === false) add(' .boost-tick', 'display:none !important;');
  if (m.numSize != null) add(' #boost-big', `font-size:${m.numSize}px !important;`);
  if (m.numColor) add(' #boost-big', `color:${m.numColor} !important;`);
  if (m.speed === false) add(' #speed-val', 'display:none !important;'), add(' #speed-unit', 'display:none !important;');
  if (m.glow) add(' #boost-arc', `filter:drop-shadow(0 0 ${m.glow}px ${m.ring || 'rgba(255,255,255,0.7)'});`);
  /* cercle complet ou arc : orientation et sens (la longueur est recalée par le moteur, voir bmtRuntimeOpts) */
  if (m.arc === 'arc' || m.arc === 'full') add(' #boost-svg', `transform:${arcTransform(m.arc === 'full', m.open, m.sweep, m.ccw)} !important;`);
  if (m.cap) { add(' #boost-arc', `stroke-linecap:${m.cap} !important;`); add(' #boost-track', `stroke-linecap:${m.cap} !important;`); }
  return r.join('\n');
}
/* longueur de la jauge du boost meter d'origine, lue par le moteur (meta.json "boostMeter") */
function bmtRuntimeOpts() {
  const m = (S.p.elements['boost-meter'] || {}).bmt || {};
  if (m.arc === 'arc') return { sweep: m.sweep || 270 };
  if (m.arc === 'full') return { sweep: 360 };
  return null;
}

/* ─── Écran de fin : en-tête, logos, score, tableau, MVP, barres (S.p.end, !important : les thèmes de base le stylent fortement) ─── */
const END_STATS = [['score', 'Score', 'SCORE'], ['goals', 'Buts', 'GOALS'], ['assists', 'Passes D', 'ASSISTS'], ['shots', 'Tirs', 'SHOTS'], ['saves', 'Arrêts', 'SAVES'], ['demos', 'Démos', 'DEMOS']];
const END_BARS = [['goals', 'Barre des buts'], ['shots', 'Barre des tirs'], ['saves', 'Barre des arrêts']];
const MVP_POS = [['tr', 'Coin haut droit'], ['tl', 'Coin haut gauche'], ['br', 'Coin bas droit'], ['bl', 'Coin bas gauche'], ['inline', 'À côté du pseudo'], ['above', 'Au-dessus du pseudo']];
const MVP_LOOPS = [['none', 'Aucune'], ['pulse', 'Pulsation'], ['heartbeat', 'Battement'], ['glow', 'Lueur'], ['blink', 'Clignotement'], ['float', 'Flottement'], ['swing', 'Balancement'], ['shake', 'Tremblement'], ['spin', 'Rotation']];
const cssStr = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"';
function endCss(ctx) {
  const e = S.p.end || {}, R = `html ${ctx.sel} #end-screen`, r = [];
  const add = (sub, p) => r.push(`${R}${sub} { ${p} }`);
  const imp = (k, sub, prop, unit = '') => { if (e[k] != null && e[k] !== '') add(sub, `${prop}:${e[k]}${unit} !important;`); };
  /* écran entier */
  imp('align', '', 'justify-content');
  imp('gap', '', 'gap', 'px');
  /* en-tête */
  imp('hdrH', ' #end-hdr', 'height', 'px');
  imp('sideBg', ' .end-side', 'background');
  if (e.sidePad != null) add(' .end-side', `padding-left:${e.sidePad}px !important; padding-right:${e.sidePad}px !important;`);
  if (e.noWinGlow) add(' .end-side.winner', 'animation:none !important;');
  imp('stripeW', ' .end-side.blue', 'border-left-width', 'px'); imp('stripeW', ' .end-side.orange', 'border-right-width', 'px');
  imp('stripeB', ' .end-side.blue', 'border-left-color'); imp('stripeO', ' .end-side.orange', 'border-right-color');
  imp('nameSize', ' .end-side-name', 'font-size', 'px'); imp('nameColor', ' .end-side-name', 'color'); imp('nameSpacing', ' .end-side-name', 'letter-spacing', 'px');
  if (e.nameItalic) add(' .end-side-name', 'font-style:italic !important;');
  imp('resSize', ' .end-side-result', 'font-size', 'px');
  imp('resColor', ' .end-side:not(.winner) .end-side-result', 'color'); imp('resWinColor', ' .end-side.winner .end-side-result', 'color');
  if (e.hideRes) add(' .end-side-result', 'display:none !important;');
  /* logos */
  if (e.logoSize != null) {
    add(' .end-logo-sq', `width:${e.logoSize}px !important; height:${e.logoSize}px !important;`);
    add(' .end-logo-img', `width:${round(e.logoSize * .77)}px !important; height:${round(e.logoSize * .77)}px !important;`);
    add(' .end-logo-letter', `font-size:${round(e.logoSize * .43)}px !important;`);
  }
  imp('logoRadius', ' .end-logo-sq', 'border-radius', 'px'); imp('logoBg', ' .end-logo-sq', 'background');
  if (e.logoBorderW != null) add(' .end-logo-sq', `border-width:${e.logoBorderW}px !important; border-style:solid !important;`);
  imp('logoBorderC', ' .end-logo-sq', 'border-color');
  /* score central */
  imp('midW', ' #end-mid', 'width', 'px');
  if (e.boxSize != null) add(' .end-sc-box', `width:${e.boxSize}px !important; height:${e.boxSize}px !important;`);
  imp('scoreSize', ' .end-sc-box', 'font-size', 'px'); imp('boxRadius', ' .end-sc-box', 'border-radius', 'px');
  imp('boxB', ' .end-sc-box.blue', 'background'); imp('boxO', ' .end-sc-box.orange', 'background'); imp('scoreColor', ' .end-sc-box', 'color');
  imp('vsSize', ' .end-vs-sep', 'font-size', 'px'); imp('vsColor', ' .end-vs-sep', 'color');
  if (e.hideSeries) add(' .end-ser-row', 'display:none !important;');
  imp('serSize', ' .end-ser-row', 'font-size', 'px'); imp('serColor', ' .end-ser-row', 'color');
  /* tableau */
  imp('tblPad', ' #end-table', 'padding-left', 'px'); imp('tblPad', ' #end-table', 'padding-right', 'px');
  imp('topH', ' .end-p-top', 'height', 'px'); imp('topH', ' .end-lbl-top', 'height', 'px');
  imp('rowH', ' .end-p-cell', 'height', 'px'); imp('rowH', ' .end-lbl-cell', 'height', 'px');
  imp('lblW', ' #end-lbl', 'width', 'px'); imp('lblBg', ' #end-lbl', 'background');
  imp('headB', ' #end-bl .end-p-top', 'background'); imp('headO', ' #end-or .end-p-top', 'background');
  imp('pSize', ' .end-p-top', 'font-size', 'px'); imp('pColor', ' .end-p-top', 'color');
  imp('valSize', ' .end-p-cell', 'font-size', 'px'); imp('valB', ' #end-bl .end-p-cell', 'color'); imp('valO', ' #end-or .end-p-cell', 'color');
  imp('lblSize', ' .end-lbl-text', 'font-size', 'px'); imp('lblColor', ' .end-lbl-text', 'color');
  if (e.noMini) add(' .end-mini-bar', 'display:none !important;');
  if (e.noSep) add(` .end-p-cell, ${R} .end-lbl-cell, ${R} .end-p-top, ${R} .end-lbl-top`, 'border-bottom:none !important;');
  (e.hide || []).forEach(k => { const i = END_STATS.findIndex(x => x[0] === k); if (i >= 0) add(` .end-p-col > :nth-child(${i + 2}), ${R} #end-lbl > :nth-child(${i + 2})`, 'display:none !important;'); });
  /* MVP : badge (texte ou image) et mise en valeur de sa colonne */
  const m = e.mvp || {};
  if (m.mode !== 'off') {
    const B = ' .end-p-top.mvp::after', b = [];
    const st = m.style || 'text', file = fileOf(m.img);
    if (st === 'none') b.push('display:none !important');
    else if (st === 'image') {
      const sz = m.imgSize ?? 28;
      if (file) b.push(`content:'' !important`, `width:${sz}px !important`, `height:${sz}px !important`, `background:url('${ctx.url(file)}') center/contain no-repeat !important`, 'padding:0 !important', 'border-radius:0 !important');
    } else {
      if (m.text) b.push(`content:${cssStr(m.text)} !important`);
      if (m.bg) b.push(`background:${m.bg} !important`);
      if (m.color) b.push(`color:${m.color} !important`);
      if (m.size != null) b.push(`font-size:${m.size}px !important`, 'padding:.18em .45em !important');
      if (m.radius != null) b.push(`border-radius:${m.radius}px !important`);
    }
    if (st !== 'none') {
      const pos = m.pos || 'tr';
      if (pos === 'tl') b.push('right:auto !important', 'left:4px !important');
      if (pos === 'br') b.push('top:auto !important', 'bottom:6px !important');
      if (pos === 'bl') b.push('top:auto !important', 'bottom:6px !important', 'right:auto !important', 'left:4px !important');
      if (pos === 'inline') b.push('position:static !important', 'margin-left:8px !important', 'flex-shrink:0 !important');
      if (pos === 'above') {
        b.push('top:auto !important', 'bottom:calc(100% + 4px) !important', 'left:0 !important', 'right:0 !important', 'margin:0 auto !important', 'width:max-content', 'z-index:3');
        add(' .end-p-top.mvp', 'overflow:visible !important; z-index:3;');
      }
      if (m.dx || m.dy) b.push(`translate:${m.dx || 0}px ${m.dy || 0}px`);
      if (m.loop && m.loop !== 'none') b.push(`animation:${animName(m.loop, 'loop')} ${m.loopDur ?? 1.6}s ${m.loop === 'spin' ? 'linear' : 'ease-in-out'} infinite !important`, `--st-glow:${m.bg || '#ffd700'}`);
    }
    if (b.length) add(B, b.join('; ') + ';');
    if (m.headBg) add(' .end-p-top.mvp', `background:${m.headBg} !important;`);
    if (m.nameColor) add(' .end-p-top.mvp', `color:${m.nameColor} !important;`);
    if (m.colBg) add(' .st-mvp-col', `background:${m.colBg} !important;`);
    if (m.valColor) add(' .st-mvp-col .end-p-cell', `color:${m.valColor} !important;`);
    const sh = [];
    if (m.borderW) sh.push(`inset 0 0 0 ${m.borderW}px ${m.glowC || '#ffd700'}`);
    if (m.glow) sh.push(`0 0 ${m.glow}px ${m.glowC || '#ffd700'}`);
    if (sh.length) add(' .st-mvp-col', `box-shadow:${sh.join(', ')} !important; position:relative; z-index:1;`);
  }
  /* barres de comparaison */
  imp('barH', ' .end-bar-track', 'height', 'px'); imp('barR', ' .end-bar-track', 'border-radius', 'px'); imp('barGap', ' .end-bar-track', 'gap', 'px');
  imp('trackBg', ' .end-bar-track', 'background'); imp('barB', ' .end-bf.b', 'background'); imp('barO', ' .end-bf.o', 'background');
  imp('bvSize', ' .end-bv', 'font-size', 'px'); imp('bvB', ' .end-bv.r', 'color'); imp('bvO', ' .end-bv.l', 'color');
  imp('blSize', ' .end-bl-lbl', 'font-size', 'px'); imp('blColor', ' .end-bl-lbl', 'color');
  imp('barsBg', ' #end-bars', 'background'); imp('barsGap', ' #end-bars', 'gap', 'px');
  imp('barsPad', ' #end-bars', 'padding-left', 'px'); imp('barsPad', ' #end-bars', 'padding-right', 'px');
  (e.barsHide || []).forEach(k => add(` #end-bar-${k}`, 'display:none !important;'));
  return r.join('\n');
}
/* textes et MVP lus par le moteur (meta.json "end") */
function endRuntimeOpts() {
  const e = S.p.end || {}, o = {};
  if (e.winText) o.winText = e.winText;
  if (e.loseText) o.loseText = e.loseText;
  if (e.vs) o.vs = e.vs;
  if (e.mvp && e.mvp.mode) o.mvpMode = e.mvp.mode;
  if (e.labels && Object.values(e.labels).some(Boolean)) o.labels = { ...e.labels };
  return Object.keys(o).length ? o : null;
}

/* ─── Victoire de la série : halo, barres, reflet, titre, nom, logo, sous-titre, score + animations d'entrée ─── */
const WIN_PARTS = { 'win-label': 'label', 'win-logo-wrap': 'logo', 'win-team-name': 'name', 'win-subtitle': 'sub', 'win-series-score': 'score' };
const WIN_DELAY = { label: .5, logo: .15, name: .35, sub: .6, score: .72 };
function winCss(ctx) {
  const w = S.p.win || {}, R = `html ${ctx.sel} #win-screen`, r = [];
  const add = (sub, p) => r.push(`${R}${sub} { ${p} }`);
  const imp = (k, sub, prop, unit = '') => { if (w[k] != null && w[k] !== '') add(sub, `${prop}:${w[k]}${unit} !important;`); };
  if (w.accent) ['#win-glow', '#win-bar-top', '#win-bar-bot'].forEach(id => add(' ' + id, `background:${w.accent} !important;`));
  if (w.noGlow) add(' #win-glow', 'display:none !important;');
  if (w.glowSize != null) add(' #win-glow', `width:${w.glowSize}px !important; height:${w.glowSize}px !important;`);
  if (w.noBars) add(' #win-bar-top, ' + R + ' #win-bar-bot', 'display:none !important;');
  imp('barH', ' #win-bar-top', 'height', 'px'); imp('barH', ' #win-bar-bot', 'height', 'px');
  if (w.noShine) add(' #win-shine', 'display:none !important;');
  imp('gap', ' #win-content', 'gap', 'px');
  imp('labelSize', ' #win-label', 'font-size', 'px'); imp('labelColor', ' #win-label', 'color'); imp('labelSpacing', ' #win-label', 'letter-spacing', 'px');
  imp('nameSize', ' #win-team-name', 'font-size', 'px'); imp('nameColor', ' #win-team-name', 'color'); imp('nameSpacing', ' #win-team-name', 'letter-spacing', 'px');
  if (w.nameItalic === false) add(' #win-team-name', 'font-style:normal !important;');
  if (w.nameStroke) add(' #win-team-name', `-webkit-text-stroke:${w.nameStroke}px ${w.nameStrokeC || '#000000'} !important; paint-order:stroke fill;`);
  if (w.nameGlow) add(' #win-team-name', `text-shadow:0 0 ${w.nameGlow}px ${w.nameGlowC || 'currentColor'} !important;`);
  if (w.logoSize != null) { add(' #win-logo-wrap', `width:${w.logoSize}px !important; height:${w.logoSize}px !important;`); add(' #win-logo-letter', `font-size:${round(w.logoSize * .64)}px !important;`); }
  imp('subSize', ' #win-subtitle', 'font-size', 'px'); imp('subColor', ' #win-subtitle', 'color'); imp('subSpacing', ' #win-subtitle', 'letter-spacing', 'px');
  imp('scoreSize', ' #win-series-score', 'font-size', 'px'); imp('scoreColor', ' #win-series-score', 'color'); imp('scoreSpacing', ' #win-series-score', 'letter-spacing', 'px');
  /* animations d'entrée : celle du thème, aucune, ou une animation du Studio */
  for (const [id, part] of Object.entries(WIN_PARTS)) {
    const a = (w.anim || {})[part];
    if (!a || !a.in) continue;
    if (a.in === 'none') add(`.show #${id}`, 'animation:none !important; opacity:1 !important;');
    else add(`.show #${id}`, `opacity:1; animation:${animName(a.in, 'in')} ${a.dur ?? .6}s ${EASES[a.ease || 'smooth']} ${a.delay ?? WIN_DELAY[part]}s both !important;`);
  }
  return r.join('\n');
}
function winRuntimeOpts() {
  const w = S.p.win || {}, o = {};
  if (w.label) o.label = w.label;
  if (w.sub) o.sub = w.sub;
  return Object.keys(o).length ? o : null;
}

/* Bandeau médias (calque ou élément d'origine) : fond, arrondi, bordure, marge et ajustement des médias */
function mediaCss(s, m, box) {
  const b = [];
  if (m.bg != null) b.push(`background:${m.bg}`);
  if (m.radius != null) b.push(`border-radius:${m.radius}px`);
  if (m.borderW) b.push(`border:${m.borderW}px solid ${m.borderC || '#ffffff'}`, 'box-sizing:border-box');
  let css = b.length ? `${s} ${box} { ${b.join('; ')}; }` : '';
  const im = [];
  if (m.pad != null) im.push(`padding:${m.pad}px`);
  if (m.fit) im.push(`object-fit:${m.fit}`);
  if (im.length) css += `\n${s} ${box} > img { ${im.join('; ')}; box-sizing:border-box; }`;
  if (m.vfit) css += `\n${s} ${box} > video { object-fit:${m.vfit}; }`;
  return css;
}

/* Sidebars : lignes, textes, barre de boost et notifications (!important : les thèmes de base les stylent fortement) */
const NOTIF_ANIMS = [['default', 'Glisse du bas (origine)'], ['side', 'Sort de la ligne'], ['down', 'Tombe du haut'], ['bounce', 'Rebond'], ['pop', 'Pop'],
  ['zoom', 'Zoom'], ['fade', 'Fondu'], ['flip', 'Bascule'], ['spin', 'Tourbillon']];
function sidebarsCss(sel) {
  const out = [];
  for (const side of ['blue', 'orange']) {
    const c = (S.p.sidebar && S.p.sidebar[side]) || {};
    if (!Object.keys(c).length) continue;
    const R = `html ${sel} #sidebar-${side}`;
    const add = (sub, p) => out.push(`${R}${sub} { ${p} }`);
    if (c.width != null) add('', `width:${c.width}px !important;`);
    if (c.gap != null) add('', `gap:${c.gap}px !important;`);
    if (c.rowH != null) add(' .pr-info', `height:${c.rowH}px !important;`);
    if (c.radius != null) add(' .player-row', `border-radius:${c.radius}px !important;`);
    if (c.rowBg) add(' .player-row:not(.spectating)', `background:${c.rowBg} !important;`);
    if (c.specBg) add(' .player-row.spectating', `background:${c.specBg} !important;`);
    if (c.accentW != null) add(' .pr-accent', `width:${c.accentW}px !important;`);
    if (c.accentColor) add(' .pr-accent', `background:${c.accentColor} !important;`);
    if (c.nameSize != null) add(' .pr-name', `font-size:${c.nameSize}px !important;`);
    if (c.nameColor) add(' .player-row:not(.spectating) .pr-name', `color:${c.nameColor} !important;`);
    if (c.valSize != null) add(' .pr-val', `font-size:${c.valSize}px !important;`);
    if (c.valColor) add(' .player-row:not(.spectating) .pr-val', `color:${c.valColor} !important;`);
    if (c.boost === 'hide') add(' .pr-boost-bar', 'display:none !important;');
    if (c.boost === 'top') add(' .player-row', 'display:flex !important; flex-direction:column-reverse !important;');
    if (c.boost === 'fill') {
      /* la ligne entière se remplit avec le boost, derrière le nom (orange : depuis la droite) */
      add(' .player-row', 'position:relative !important;');
      add(' .pr-boost-bar', 'position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; z-index:0 !important;' + (c.boostBg ? '' : ' background:transparent !important;'));
      add(' .pr-info', 'position:relative !important; z-index:1 !important;');
      add(' .pr-boost-fill', `opacity:${c.boostAlpha ?? .6} !important;${side === 'orange' && c.boostDir !== 'ltr' ? ' transform-origin:right center !important;' : ''}`);
    } else if (c.boostH != null) add(' .pr-boost-bar', `height:${c.boostH}px !important;`);
    if (c.boostBg) add(' .pr-boost-bar', `background:${c.boostBg} !important;`);
    if (c.boostC1) add(' .pr-boost-fill', `background:linear-gradient(90deg, ${c.boostC1}, ${c.boostC2 || c.boostC1}) !important;`);
    const ns = c.notifSize ?? c.rowH;
    if (ns != null) { add(' .pr-icon', `width:${ns}px !important; height:${ns}px !important;`); add(' .pr-icons', `height:${ns}px !important;`); }
    if (c.notifGap != null) add(' .pr-icons', `${side === 'blue' ? 'left' : 'right'}:calc(100% + ${c.notifGap}px) !important;`);
    if (c.notifY != null) add(' .pr-icons', `top:${c.notifY}px !important;`);
    if (c.notifBg) add(' .pr-icon', `background:${c.notifBg} !important; opacity:1 !important;`);
    if (c.notifRadius != null) add(' .pr-icon', `border-radius:${c.notifRadius}px !important;`);
    if (c.notifAnim && c.notifAnim !== 'default') {
      const n = c.notifAnim === 'side' ? `st-notif-side-${side}` : `st-notif-${c.notifAnim}`;
      add(' .pr-icon, ' + R + ' .pr-demo-names', `animation:${n} 5s ${EASES[c.notifEase || 'smooth']} forwards !important;`);
    }
  }
  return out.join('\n');
}

function buildStudioCss(ctx) {
  const p = S.p, out = [], imports = [];
  const g = new Set();
  const want = f => { if (!f) return; const def = FONTS.find(x => x.name === f); if (def && !def.loaded) g.add(f); };
  want(p.font);
  Object.values(p.elements).forEach(d => want(d.font));
  p.layers.forEach(L => { if (L.type === 'text') want(L.text && L.text.font); if (L.type === 'series') want(L.series && L.series.font); if (L.type === 'boost') want(L.boost && L.boost.font); });
  p.fonts.forEach(f => g.delete(f.family));
  if (g.size) imports.push(`@import url('${googleUrl([...g])}');`);
  for (const f of p.fonts) { const file = fileOf(f.asset); if (file) out.push(`@font-face { font-family:'${f.family.replace(/'/g, '')}'; src:url('${ctx.url(file)}'); font-display:block; }`); }
  const vars = Object.entries(p.vars).filter(([, v]) => v !== '' && v != null);
  if (vars.length) out.push(`${ctx.sel} { ${vars.map(([k, v]) => `${k}:${v};`).join(' ')} }`);
  if (p.font) {
    const roots = ['#top-bar', '#overlay-root', '#boost-meter', '#end-screen', '#win-screen'];
    out.push(`${roots.map(r => `${ctx.sel} ${r}, ${ctx.sel} ${r} *`).join(', ')} { font-family:${fontStack(p.font)} !important; }`);
  }
  for (const E of ELEMENTS) { const d = p.elements[E.key]; if (d && Object.keys(d).length) { const c = elementCss(E, d, ctx.sel); if (c) out.push(c); } }
  const sb = sidebarsCss(ctx.sel);
  if (sb) out.push(sb);
  const ec = endCss(ctx), wc = winCss(ctx);
  if (ec) out.push(ec);
  if (wc) out.push(wc);
  /* animations REPLAY / LIVE de base masquées (le moment reste déclenché pour les calques perso) */
  const tr = p.transitions || {};
  const hideWipe = (word, vids) => [`#replay-wipe[data-st-word="${word}"]`, ...vids].map(x => `html ${ctx.sel} ${x}`).join(', ') + ' { visibility:hidden !important; }';
  if (tr.hideReplay) out.push(hideWipe('replay', ['#tw-replay-video', '#lc-transition-video', '#rs-transition-video']));
  if (tr.hideLive) out.push(hideWipe('live', ['#tw-live-video', '#lc-live-video', '#rs-live-video']));
  realLayers().forEach(L => out.push(layerCss(L, ctx.sel, ctx)));
  if (p.importedCss) out.push(p.importedCss);
  if (p.customCss) out.push(p.customCss.split(':theme').join(ctx.sel));
  return { imports, css: out.join('\n') };
}
const studioPreviewCss = () => { const s = buildStudioCss(previewCtx); return s.imports.join('\n') + '\n' + s.css; };

function layerSpecs(ctx) {
  return realLayers().map(L => {
    const spec = { id: L.id, type: L.type, show: showList(L), z: L.z || 'front', out: (L.anim && L.anim.out) || 'fade', loop: L.loop !== false };
    const gs = groupShow(groupOf(L));
    if (gs) spec.gshow = gs;
    if (effHidden(L)) spec.hidden = true;
    if (L.type === 'text') { spec.text = (L.text && L.text.content) || ''; if (L.text && L.text.hideEmpty) spec.hideEmpty = true; }
    if (L.type === 'logo') spec.team = L.team || 'blue';
    if (L.type === 'video' && L.toEnd) { spec.toEnd = true; spec.loop = false; }
    if (L.type === 'series') { const r = L.series || {}; Object.assign(spec, { team: r.team || 'blue', style: r.style || 'rects', dir: r.dir || 'ltr', vertical: !!r.vertical, fmt: r.fmt || 'wins' }); }
    if (L.type === 'boost') { const b = L.boost || {}; Object.assign(spec, { style: b.style || 'bar', num: b.num || 'center', segs: b.segs || 10 }); if (b.style === 'arc' && b.sweep) spec.sweep = b.sweep; }
    const file = fileOf(L.asset);
    if (file) { if (ctx.install) spec.file = file; else spec.url = ctx.url(file); }
    return spec;
  });
}
const extKind = file => /\.(webm|mp4|mov)$/i.test(file || '') ? 'video' : 'image';
function previewMedia() {
  const t = S.p.transitions || {}, bw = (S.base.meta && S.base.meta.wipeVideos) || {}, base = S.p.base;
  let wipe = null;
  if (fileOf(t.replay) || fileOf(t.live)) {
    wipe = {};
    if (fileOf(t.replay)) wipe.replay = `/studio-work/${fileOf(t.replay)}`; else if (bw.replay) wipe.replay = `/themes/${base}/${bw.replay}`;
    if (fileOf(t.live)) wipe.live = `/studio-work/${fileOf(t.live)}`; else if (bw.live) wipe.live = `/themes/${base}/${bw.live}`;
    ['replayCut', 'liveCut', 'replayDelay', 'liveDelay'].forEach(k => { if (t[k] !== '' && t[k] != null) wipe[k] = Number(t[k]); });
  }
  const eb = fileOf(S.p.endBg) ? { url: `/studio-work/${fileOf(S.p.endBg)}`, kind: extKind(fileOf(S.p.endBg)) } : null;
  const options = { timerShort: !!S.p.options.timerShort || (S.base.meta && S.base.meta.timerFormat === 'm:ss'), goal: goalRuntimeOpts(), end: endRuntimeOpts(), win: winRuntimeOpts(), boostMeter: bmtRuntimeOpts() };
  return { wipe, endBg: eb, options };
}

/* Envoi vers l'aperçu, groupé par image (niveaux : css < layers < all) */
const LEVEL = { css: 1, layers: 2, all: 3 };
let pushLevel = 0, pushRaf = 0, varsDirty = false;
function schedule(level) {
  pushLevel = Math.max(pushLevel, LEVEL[level] || 1);
  if (!pushRaf) pushRaf = requestAnimationFrame(flushPreview);
}
function flushPreview() {
  pushRaf = 0;
  const f = F();
  if (!f || !S.frameOk) return;
  const lvl = pushLevel; pushLevel = 0;
  try {
    if (lvl >= 3) {
      f.setTheme(S.p.base);
      f.setCss(S.base.previewCss, studioPreviewCss());
      const m = previewMedia();
      f.setWipe(m.wipe); f.setEndBg(m.endBg); f.setOptions(m.options);
      f.setBg(S.bg);
      f.reColor();
    } else f.setCss(null, studioPreviewCss());
    if (lvl >= 2) f.setLayers(layerSpecs(previewCtx));
    if (varsDirty) { varsDirty = false; f.reColor(); }
  } catch (e) { console.warn('[studio] aperçu', e); }
}

async function loadBase(id) {
  id = id || 'rlcs';
  S.base.id = id;
  let css = '', meta = {};
  if (id !== 'rlcs') {
    try { const r = await fetch(`/themes/${id}/theme.css`, { cache: 'no-store' }); if (r.ok) css = await r.text(); } catch (e) {}
    try { const r = await fetch(`/themes/${id}/meta.json`, { cache: 'no-store' }); if (r.ok) meta = await r.json(); } catch (e) {}
  }
  if (S.base.id !== id) return;
  const pb = processBaseCss(css, 'rlo-studio', id, id);
  S.base = { id, css, meta, previewCss: pb.imports.join('\n') + '\n' + pb.css };
  schedule('all');
  setTimeout(() => { if (S.tab === 'theme') renderInspector(); }, 600);
}

/* ─────────────────────────── Historique & sauvegarde auto ─────────────────────────── */
const HIST = { stack: [], i: -1 };
let commitT = 0;
function commit() {
  clearTimeout(commitT);
  const snap = JSON.stringify(S.p);
  if (HIST.stack[HIST.i] === snap) return;
  HIST.stack.splice(HIST.i + 1);
  HIST.stack.push(snap);
  if (HIST.stack.length > 150) HIST.stack.shift();
  HIST.i = HIST.stack.length - 1;
  autosave();
  updateUndo();
}
const commitSoon = (ms = 400) => { clearTimeout(commitT); commitT = setTimeout(commit, ms); };
function resetHistory() { HIST.stack = [JSON.stringify(S.p)]; HIST.i = 0; updateUndo(); }
function updateUndo() {
  $('[data-act="undo"]').disabled = HIST.i <= 0;
  $('[data-act="redo"]').disabled = HIST.i >= HIST.stack.length - 1;
}
function restoreSnap(snap) {
  const prevBase = S.p.base;
  S.p = normalize(JSON.parse(snap));
  S.sels = (S.sels || []).filter(selExists);
  if (S.sel && !selExists(S.sel)) S.sel = S.sels[S.sels.length - 1] || null;
  if (S.p.base !== prevBase) loadBase(S.p.base); else schedule('all');
  schedule('layers');
  renderAll();
  autosave();
}
function undo() { commitNow(); if (HIST.i > 0) { HIST.i--; restoreSnap(HIST.stack[HIST.i]); updateUndo(); } }
function redo() { if (HIST.i < HIST.stack.length - 1) { HIST.i++; restoreSnap(HIST.stack[HIST.i]); updateUndo(); } }
function commitNow() { if (commitT) { clearTimeout(commitT); commitT = 0; commit(); } }

/* Sauvegarde automatique : sur le disque de l'app (fiable même si le stockage du navigateur est
   vidé à la fermeture) + localStorage en secours. Retient aussi le fichier .rlstudio ouvert. */
let saveT = 0;
const autosaveBody = () => JSON.stringify({ project: S.p, file: S.filePath || null, dirty: !!S.dirty });
function autosave() {
  updateFileLabel();
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    try { localStorage.setItem('rlo-studio:project', JSON.stringify(S.p)); localStorage.setItem('rlo-studio:file', S.filePath || ''); } catch (e) {}
    try {
      const r = await fetch('/api/studio/autosave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: autosaveBody() });
      if (!r.ok) throw new Error();
      $('#st-save').textContent = 'Sauvegarde auto ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { $('#st-save').textContent = 'Sauvegarde auto impossible'; }
  }, 600);
}
/* Fichier ouvert + modifications non enregistrées (point) dans la barre du haut et le titre */
S.filePath = null; S.savedSnap = null; S.dirty = false;
const baseName = f => String(f || '').split(/[\\/]/).pop();
function updateFileLabel() {
  S.dirty = S.savedSnap != null ? JSON.stringify(S.p) !== S.savedSnap : S.dirty;
  const lbl = $('#file-lbl');
  if (lbl) {
    lbl.textContent = S.filePath ? baseName(S.filePath) : 'Projet non enregistré';
    lbl.classList.toggle('dirty', S.dirty || !S.filePath);
    lbl.title = S.filePath ? `${S.filePath}${S.dirty ? '\nModifications non enregistrées (Ctrl+S)' : '\nEnregistré'}` : 'Ctrl+S pour enregistrer le projet dans un fichier';
  }
  document.title = `${S.dirty ? '• ' : ''}${S.p.name || 'Studio'} — Studio RL Overlay`;
}
function markSaved(file) {
  if (file !== undefined) S.filePath = file;
  S.savedSnap = JSON.stringify(S.p);
  S.dirty = false;
  autosave();
}
function savePrefs() { try { localStorage.setItem('rlo-studio:prefs', JSON.stringify({ snap: S.snap, grid: S.grid, rulers: S.rulers, bg: S.bg })); } catch (e) {} }

/* Modification du projet : aperçu + historique + interface */
function changed(level = 'css', opts = {}) {
  schedule(level);
  if (opts.vars) varsDirty = true;
  if (opts.commit === 'now') commit(); else if (opts.commit !== false) commitSoon();
  if (opts.layers) renderLayers();
  if (opts.inspector) renderInspector(); else refreshFields();
  renderSel();
}

/* ─────────────────────────── Vue : zoom, navigation, règles, grille ─────────────────────────── */
const vp = $('#viewport'), stage = $('#stage'), world = $('#world'), ui = $('#ui');
const stageRect = () => stage.getBoundingClientRect();
function applyView() {
  world.style.transform = `translate(${S.panX}px, ${S.panY}px) scale(${S.zoom})`;
  $('#zoom-lbl').textContent = Math.round(S.zoom * 100) + ' %';
  drawRulers(); drawGrid(); drawGuides(); renderSel();
}
function fit() {
  const r = stageRect();
  const z = clamp(Math.min((r.width - 48) / W, (r.height - 48) / H), .08, 4);
  S.zoom = z; S.panX = (r.width - W * z) / 2; S.panY = (r.height - H * z) / 2;
  S.autoFit = true;
  applyView();
}
function zoomAt(z, sx, sy) {
  const r = stageRect();
  if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
  z = clamp(z, .08, 4);
  const cx = (sx - S.panX) / S.zoom, cy = (sy - S.panY) / S.zoom;
  S.zoom = z; S.panX = sx - cx * z; S.panY = sy - cy * z;
  S.autoFit = false;
  applyView();
}
const ZSTEPS = [.1, .125, .167, .25, .333, .5, .667, .75, 1, 1.25, 1.5, 2, 3, 4];
const zoomStep = dir => { const z = S.zoom; const n = dir > 0 ? ZSTEPS.find(s => s > z + .001) : [...ZSTEPS].reverse().find(s => s < z - .001); zoomAt(n || z); };
const toCanvas = (cx, cy) => { const r = stageRect(); return { x: (cx - r.left - S.panX) / S.zoom, y: (cy - r.top - S.panY) / S.zoom }; };
const sx = x => S.panX + x * S.zoom, sy = y => S.panY + y * S.zoom;

function drawRulers() {
  vp.classList.toggle('rulers-on', S.rulers);
  if (!S.rulers) return;
  const dpr = devicePixelRatio || 1;
  const majorFor = () => [10, 20, 50, 100, 200, 500, 1000].find(s => s * S.zoom >= 60) || 1000;
  const major = majorFor(), minor = major / (major === 50 || major === 500 ? 5 : 10);
  const selA = selectedAabb();
  [['top', $('#ruler-top')], ['left', $('#ruler-left')]].forEach(([side, cv]) => {
    const len = side === 'top' ? cv.clientWidth : cv.clientHeight;
    if (!len) return;
    cv.width = (side === 'top' ? len : 20) * dpr; cv.height = (side === 'top' ? 20 : len) * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = '#111319'; c.fillRect(0, 0, side === 'top' ? len : 20, side === 'top' ? 20 : len);
    const pan = side === 'top' ? S.panX : S.panY, lim = side === 'top' ? W : H;
    c.fillStyle = 'rgba(61,123,255,.10)';
    const a0 = pan, a1 = pan + lim * S.zoom;
    if (side === 'top') c.fillRect(a0, 0, a1 - a0, 20); else c.fillRect(0, a0, 20, a1 - a0);
    if (selA) {
      c.fillStyle = 'rgba(61,155,255,.35)';
      const s0 = pan + (side === 'top' ? selA.l : selA.t) * S.zoom, s1 = pan + (side === 'top' ? selA.r : selA.b) * S.zoom;
      if (side === 'top') c.fillRect(s0, 0, s1 - s0, 20); else c.fillRect(0, s0, 20, s1 - s0);
    }
    c.strokeStyle = '#3a4050'; c.fillStyle = '#7d8396'; c.font = '9px Inter, sans-serif'; c.lineWidth = 1;
    const start = Math.floor((-pan / S.zoom) / minor) * minor, end = (len - pan) / S.zoom;
    c.beginPath();
    for (let v = start; v <= end; v += minor) {
      const p = Math.round(pan + v * S.zoom) + .5;
      const isMajor = Math.abs(v % major) < .001 || Math.abs(Math.abs(v % major) - major) < .001;
      const t = isMajor ? 20 : (Math.abs(v % (major / 2)) < .001 ? 7 : 4);
      if (side === 'top') { c.moveTo(p, 20); c.lineTo(p, 20 - t); } else { c.moveTo(20, p); c.lineTo(20 - t, p); }
      if (isMajor) {
        if (side === 'top') c.fillText(String(Math.round(v)), p + 3, 9);
        else { c.save(); c.translate(9, p - 3); c.rotate(-Math.PI / 2); c.fillText(String(Math.round(v)), 0, 0); c.restore(); }
      }
    }
    c.stroke();
  });
}
function drawGrid() {
  const g = $('#grid-layer');
  vp.classList.toggle('grid-on', S.grid);
  if (!S.grid) return;
  const step = 40 * S.zoom, big = 160 * S.zoom;
  Object.assign(g.style, { left: sx(0) + 'px', top: sy(0) + 'px', width: W * S.zoom + 'px', height: H * S.zoom + 'px',
    backgroundImage: `linear-gradient(rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.13) 1px, transparent 1px),
      linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
    backgroundSize: `${big}px ${big}px, ${big}px ${big}px, ${step}px ${step}px, ${step}px ${step}px` });
}
function drawGuides() {
  const gl = $('#guides-layer');
  if (!S.rulers) { gl.innerHTML = ''; return; }
  const g = S.p.guides;
  gl.innerHTML = g.v.map((x, i) => `<div class="guide v" data-g="v" data-i="${i}" style="left:${sx(x)}px"></div>`).join('')
    + g.h.map((y, i) => `<div class="guide h" data-g="h" data-i="${i}" style="top:${sy(y)}px"></div>`).join('');
}

/* ─────────────────────────── Boîtes des éléments et calques ─────────────────────────── */
function sceneShowsElement(E) { return E.scene === S.scene || (E.scene === 'game' && ['game', 'goal', 'wreplay', 'replay', 'wlive', 'ot'].includes(S.scene)); }
function visibleChain(el, win) {
  let o = 1;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cs = win.getComputedStyle(n);
    if (cs.display === 'none') return false;
    o *= parseFloat(cs.opacity);
  }
  return o > .04;
}
function measureAll() {
  const doc = FD(), win = frame.contentWindow;
  if (!doc || !doc.body || !win) return;
  for (const E of ELEMENTS) {
    const el = elNode(doc, E);
    if (!el) { S.boxes.delete(E.key); continue; }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { S.boxes.delete(E.key); continue; }
    const d = S.p.elements[E.key] || {}, rot = d.r || 0;
    let w = r.width, h = r.height;
    if (rot) { w = el.offsetWidth * (d.s ?? 1); h = el.offsetHeight * (d.s ?? 1); }
    S.boxes.set(E.key, { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w, h, rot, vis: visibleChain(el, win) && !d.hidden });
  }
}
const layerBox = L => ({ cx: L.x + L.w / 2, cy: L.y + L.h / 2, w: L.w, h: L.h, rot: L.r || 0, vis: true });
function aabb(b) {
  const a = (b.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const hw = (b.w * c + b.h * s) / 2, hh = (b.w * s + b.h * c) / 2;
  return { l: b.cx - hw, r: b.cx + hw, t: b.cy - hh, b: b.cy + hh, cx: b.cx, cy: b.cy };
}
function layerVisibleInScene(L) {
  if (!L || isGroup(L) || effHidden(L)) return false;
  const f = F();
  if (!f || !f.isShown) return true;
  const gs = groupShow(groupOf(L));
  return f.isShown(showList(L)) && (!gs || f.isShown(gs));
}
/* Cadre d'un dossier : englobe ses calques visibles (ou tous s'il n'y en a aucun de visible) */
function groupBox(gid) {
  const all = membersOf(gid), vis = all.filter(L => layerVisibleInScene(L));
  const list = vis.length ? vis : all;
  if (!list.length) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const L of list) { const a = aabb(layerBox(L)); l = Math.min(l, a.l); t = Math.min(t, a.t); r = Math.max(r, a.r); b = Math.max(b, a.b); }
  return { cx: (l + r) / 2, cy: (t + b) / 2, w: r - l, h: b - t, rot: 0, vis: vis.length > 0 };
}
function items() {
  const list = [];
  for (const L of realLayers()) if (layerVisibleInScene(L)) list.push({ kind: 'layer', id: L.id, box: layerBox(L), z: L.z || 'front', locked: effLocked(L) });
  for (const E of ELEMENTS) {
    if (!sceneShowsElement(E)) continue;
    const b = S.boxes.get(E.key);
    if (b && b.vis) list.push({ kind: 'el', id: E.key, box: b, locked: !!(S.p.elements[E.key] || {}).locked });
  }
  return list;
}
function itemBox(sel) {
  if (!sel) return null;
  if (sel.kind === 'group') return groupBox(sel.id);
  if (sel.kind === 'layer') { const L = layerById(sel.id); return L && !isGroup(L) ? layerBox(L) : null; }
  return S.boxes.get(sel.id) || null;
}
const selectedAabb = () => { const b = isMulti() ? multiBox() : itemBox(S.sel); return b ? aabb(b) : null; };
function inside(b, pt) {
  const a = -(b.rot || 0) * Math.PI / 180, dx = pt.x - b.cx, dy = pt.y - b.cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
}
function hitTest(pt) {
  const its = items();
  /* un calque d'un dossier replié sélectionne le dossier entier */
  const up = it => {
    if (it && it.kind === 'layer') { const g = groupOf(layerById(it.id)); if (g && !g.open) return { kind: 'group', id: g.id, box: groupBox(g.id), locked: !!g.locked }; }
    return it;
  };
  for (const it of its) if (it.kind === 'layer' && it.z !== 'back' && inside(it.box, pt)) return up(it);
  const els = its.filter(it => it.kind === 'el' && inside(it.box, pt)).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h);
  if (els.length) return els[0];
  for (const it of its) if (it.kind === 'layer' && it.z === 'back' && inside(it.box, pt)) return up(it);
  return null;
}
/* Nom affiché : nom donné par l'utilisateur, sinon nom d'origine (éléments de l'overlay compris) */
const elName = key => ((S.p.elements[key] || {}).name) || EL[key].label;
const itemName = sel => !sel ? '' : sel.kind === 'el' ? elName(sel.id) : ((layerById(sel.id) || {}).name || (sel.kind === 'group' ? 'Dossier' : 'Calque'));
/* Renommer dans le panneau (double-clic, F2, clic droit → Renommer) — vide = nom d'origine pour un élément */
function startRename(sel) {
  if (!sel) return;
  const row = $(`#layer-list .lrow[data-kind="${sel.kind}"][data-id="${CSS.escape(sel.id)}"]`);
  const nm = row && row.querySelector('.l-name');
  if (!nm || nm.querySelector('input')) return;
  const obj = sel.kind === 'el' ? elData(sel.id) : layerById(sel.id);
  if (!obj) return;
  nm.innerHTML = '';
  const inp = h('input', { value: itemName(sel), maxlength: 40, placeholder: sel.kind === 'el' ? EL[sel.id].label : '' });
  nm.append(inp);
  inp.focus(); inp.select();
  let finished = false;
  const done = ok => {
    if (finished) return;
    finished = true;
    if (ok) {
      const v = inp.value.replace(/\s+/g, ' ').trim();
      if (sel.kind === 'el') { if (!v || v === EL[sel.id].label) delete obj.name; else obj.name = v; }
      else if (v) obj.name = v;
      commit();
    }
    renderLayers(); renderInspector(); renderSel();
  };
  inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
  inp.addEventListener('blur', () => done(true));
  ['click', 'dblclick', 'mousedown'].forEach(t => inp.addEventListener(t, ev => ev.stopPropagation()));
}

/* ─────────────────────────── Sélection : rendu ─────────────────────────── */
const selBox = $('#sel-box'), hoverBox = $('#hover-box');
function placeBox(el, b) {
  Object.assign(el.style, { display: 'block', left: sx(b.cx - b.w / 2) + 'px', top: sy(b.cy - b.h / 2) + 'px',
    width: b.w * S.zoom + 'px', height: b.h * S.zoom + 'px', transform: b.rot ? `rotate(${b.rot}deg)` : '' });
}
function renderSel() {
  const multi = isMulti(), ml = $('#multi-layer');
  const b = multi ? multiBox() : itemBox(S.sel);
  if (!b) { selBox.style.display = 'none'; ml.innerHTML = ''; $('#st-sel').textContent = ''; return; }
  ml.innerHTML = multi ? selList().map(s => { const x = itemBox(s); if (!x) return ''; return `<div class="multi-out" style="left:${sx(x.cx - x.w / 2)}px;top:${sy(x.cy - x.h / 2)}px;width:${x.w * S.zoom}px;height:${x.h * S.zoom}px;${x.rot ? `transform:rotate(${x.rot}deg)` : ''}"></div>`; }).join('') : '';
  placeBox(selBox, b);
  if (multi) {
    selBox.classList.remove('locked', 'ghost');
    selBox.classList.add('no-edges', 'no-rot', 'multi');
    selBox.classList.toggle('small-top', sy(b.cy - b.h / 2) < 30);
    const n = selList().length, info = `${n} éléments · ${Math.round(b.w)} × ${Math.round(b.h)}`;
    const lbl = selBox.querySelector('.sel-label');
    if (lbl.textContent !== info) lbl.textContent = info;
    $('#st-sel').textContent = `${n} éléments — X ${Math.round(b.cx - b.w / 2)} · Y ${Math.round(b.cy - b.h / 2)} · ${Math.round(b.w)} × ${Math.round(b.h)}`;
    return;
  }
  selBox.classList.remove('multi');
  selBox.classList.toggle('locked', isLocked(S.sel));
  selBox.classList.toggle('no-edges', S.sel.kind === 'el' || S.sel.kind === 'group');
  selBox.classList.toggle('no-rot', S.sel.kind === 'group');
  selBox.classList.toggle('ghost', !b.vis);
  selBox.classList.toggle('small-top', sy(b.cy - b.h / 2) < 30);
  const a = aabb(b);
  const info = `${itemName(S.sel)} · ${Math.round(b.w)} × ${Math.round(b.h)}`;
  const lbl = selBox.querySelector('.sel-label');
  if (lbl.textContent !== info) lbl.textContent = info;
  $('#st-sel').textContent = `${itemName(S.sel)} — X ${Math.round(a.l)} · Y ${Math.round(a.t)} · ${Math.round(a.r - a.l)} × ${Math.round(a.b - a.t)}${b.rot ? ` · ${round(b.rot, 1)}°` : ''}`;
}
function renderHover(it) {
  S.hover = it ? { kind: it.kind, id: it.id } : null;
  if (!it || isSelected(it) || S.drag) { hoverBox.style.display = 'none'; return; }
  placeBox(hoverBox, it.box);
}
/* Le survol suit l'élément s'il bouge (animations, changement de scène) */
function refreshHover() {
  if (!S.hover || S.drag) { hoverBox.style.display = 'none'; return; }
  const b = itemBox(S.hover);
  const shown = S.hover.kind === 'el' ? b && b.vis && sceneShowsElement(EL[S.hover.id]) : layerVisibleInScene(layerById(S.hover.id) || { hidden: true });
  if (!b || !shown || isSelected(S.hover)) { hoverBox.style.display = 'none'; return; }
  placeBox(hoverBox, b);
}

/* ─────────────────────────── Aimants (repères intelligents) ─────────────────────────── */
/* excl : la (ou les) sélection(s) qui bougent — ignorées, ainsi que le contenu de leurs dossiers */
function snapTargets(excl) {
  excl = [].concat(excl || []);
  const xs = [{ v: 0 }, { v: W / 2 }, { v: W }], ys = [{ v: 0 }, { v: H / 2 }, { v: H }];
  S.p.guides.v.forEach(v => xs.push({ v, guide: true }));
  S.p.guides.h.forEach(v => ys.push({ v, guide: true }));
  const doc = FD();
  const selfEls = doc ? excl.filter(s => s.kind === 'el').map(s => elNode(doc, EL[s.id])).filter(Boolean) : [];
  const exGroups = new Set(excl.filter(s => s.kind === 'group').map(s => s.id));
  for (const it of items()) {
    if (excl.some(s => sameSel(s, it))) continue;
    if (it.kind === 'layer' && exGroups.has((layerById(it.id) || {}).group)) continue;
    if (selfEls.length && it.kind === 'el') { const o = elNode(doc, EL[it.id]); if (o && selfEls.some(se => o.contains(se) || se.contains(o))) continue; }
    const a = aabb(it.box);
    [a.l, a.cx, a.r].forEach(v => xs.push({ v, a }));
    [a.t, a.cy, a.b].forEach(v => ys.push({ v, a }));
  }
  return { xs, ys };
}
function snapAxis(moving, targets, thr) {
  let best = null;
  for (const m of moving) for (const t of targets) {
    const d = t.v - m;
    if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
}
function gridSnap(vals, step, thr) {
  let best = null;
  for (const m of vals) { const g = Math.round(m / step) * step, d = g - m; if (Math.abs(d) <= thr && (best == null || Math.abs(d) < Math.abs(best))) best = d; }
  return best;
}
/* Déplacement : renvoie le décalage corrigé et les lignes à afficher */
function snapMove(a0, dx, dy, selfSel, ev) {
  const guides = [];
  if (!S.snap || ev.ctrlKey) return { dx, dy, guides };
  const thr = 7 / S.zoom, T = S.drag.targets || (S.drag.targets = snapTargets(selfSel));
  const mx = [a0.l + dx, a0.cx + dx, a0.r + dx], my = [a0.t + dy, a0.cy + dy, a0.b + dy];
  let bx = snapAxis(mx, T.xs, thr), by = snapAxis(my, T.ys, thr);
  if (S.grid) { const gx = gridSnap([mx[0], mx[2]], 40, thr), gy = gridSnap([my[0], my[2]], 40, thr); if (bx == null) bx = gx; if (by == null) by = gy; }
  if (bx != null) dx += bx;
  if (by != null) dy += by;
  const A = { l: a0.l + dx, r: a0.r + dx, t: a0.t + dy, b: a0.b + dy, cx: a0.cx + dx, cy: a0.cy + dy };
  collectGuides(A, T, guides);
  return { dx, dy, guides };
}
function collectGuides(A, T, guides) {
  const seenX = new Set(), seenY = new Set();
  for (const m of [A.l, A.cx, A.r]) for (const t of T.xs) if (Math.abs(t.v - m) < .5 && !seenX.has(round(t.v))) {
    seenX.add(round(t.v));
    const y1 = t.a ? Math.min(A.t, t.a.t) : 0, y2 = t.a ? Math.max(A.b, t.a.b) : H;
    guides.push({ d: 'v', v: t.v, a: y1, b: y2 });
  }
  for (const m of [A.t, A.cy, A.b]) for (const t of T.ys) if (Math.abs(t.v - m) < .5 && !seenY.has(round(t.v))) {
    seenY.add(round(t.v));
    const x1 = t.a ? Math.min(A.l, t.a.l) : 0, x2 = t.a ? Math.max(A.r, t.a.r) : W;
    guides.push({ d: 'h', v: t.v, a: x1, b: x2 });
  }
}
function drawSmart(guides) {
  const el = $('#smart-layer');
  if (!guides || !guides.length) { el.innerHTML = ''; return; }
  el.innerHTML = guides.map(g => g.d === 'v'
    ? `<div class="smart v" style="left:${sx(g.v)}px;top:${sy(g.a)}px;height:${(g.b - g.a) * S.zoom}px"></div>`
    : `<div class="smart h" style="top:${sy(g.v)}px;left:${sx(g.a)}px;width:${(g.b - g.a) * S.zoom}px"></div>`).join('');
}
function tip(text, cx, cy) {
  const t = $('#drag-tip');
  if (!text) { t.style.display = 'none'; return; }
  const r = stageRect();
  t.textContent = text;
  Object.assign(t.style, { display: 'block', left: (cx - r.left + 16) + 'px', top: (cy - r.top + 18) + 'px' });
}

/* ─────────────────────────── Souris sur le canevas ─────────────────────────── */
function getPos(sel) {
  if (sel.kind === 'group') { const b = groupBox(sel.id); return b ? { x: b.cx - b.w / 2, y: b.cy - b.h / 2 } : { x: 0, y: 0 }; }
  if (sel.kind === 'layer') { const L = layerById(sel.id); return { x: L.x, y: L.y }; }
  const d = elData(sel.id); return { x: d.x || 0, y: d.y || 0 };
}
function setPos(sel, x, y) {
  if (sel.kind === 'group') {
    const cur = getPos(sel), dx = x - cur.x, dy = y - cur.y;
    membersOf(sel.id).forEach(L => { L.x = round(L.x + dx, 1); L.y = round(L.y + dy, 1); });
  } else if (sel.kind === 'layer') { const L = layerById(sel.id); L.x = round(x, 1); L.y = round(y, 1); }
  else { const d = elData(sel.id); d.x = round(x, 1); d.y = round(y, 1); }
}
function isLocked(sel) {
  if (!sel) return false;
  if (sel.kind === 'el') return !!elData(sel.id).locked;
  const x = layerById(sel.id);
  return sel.kind === 'group' ? !!(x && x.locked) : effLocked(x);
}

ui.addEventListener('pointerdown', e => {
  if (e.button === 1 || (e.button === 0 && S.space)) {
    e.preventDefault();
    S.drag = { type: 'pan', x: e.clientX, y: e.clientY, px: S.panX, py: S.panY };
    vp.classList.add('panning');
    ui.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;
  closeMenus();
  S.hover = null; hoverBox.style.display = 'none';
  if (document.activeElement && isInput(document.activeElement)) document.activeElement.blur();
  const pt = toCanvas(e.clientX, e.clientY);
  const g = e.target.closest && e.target.closest('.guide');
  if (g) {
    S.drag = { type: 'guide', d: g.dataset.g, i: +g.dataset.i };
    ui.setPointerCapture(e.pointerId);
    return;
  }
  const h = e.target.dataset && e.target.dataset.h;
  if (h && S.sel) {
    if (isMulti()) { if (h !== 'rot') { startMultiScale(pt); ui.setPointerCapture(e.pointerId); } return; }
    if (!isLocked(S.sel)) { startTransform(h, e, pt); ui.setPointerCapture(e.pointerId); return; }
  }
  const hit = hitTest(pt);
  /* Maj / Ctrl : ajoute l'élément et permet de glisser tout de suite toute la sélection ;
     sur un élément déjà sélectionné, un simple clic (sans glisser) le retire. Dans le vide : rectangle qui ajoute. */
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (!hit) { S.drag = { type: 'marquee', p0: pt, add: true }; ui.setPointerCapture(e.pointerId); return; }
    const hs = { kind: hit.kind, id: hit.id }, was = isSelected(hs);
    if (!was) select(hs, { toggle: true });
    startMultiMove(pt, false, was ? { ...hs, toggleOff: true } : null);
    ui.setPointerCapture(e.pointerId);
    return;
  }
  /* sélection multiple : cliquer dans le cadre la déplace en bloc */
  if (isMulti()) {
    const mb = multiBox();
    if ((hit && isSelected(hit)) || (mb && inside(mb, pt))) {
      startMultiMove(pt, e.altKey, hit);
      ui.setPointerCapture(e.pointerId);
      return;
    }
  }
  const cur = itemBox(S.sel);
  let it = cur && inside(cur, pt) && (S.sel.kind === 'layer' ? layerVisibleInScene(layerById(S.sel.id)) : cur.vis) ? { kind: S.sel.kind, id: S.sel.id, box: cur } : hit;
  if (e.altKey && it && S.sel && it.id === S.sel.id) it = hit || it;
  /* dans le vide : rectangle de sélection */
  if (!it) { S.drag = { type: 'marquee', p0: pt, add: false }; ui.setPointerCapture(e.pointerId); return; }
  if (!S.sel || isMulti() || S.sel.id !== it.id || S.sel.kind !== it.kind) select({ kind: it.kind, id: it.id });
  if (isLocked(S.sel)) return;
  if (e.altKey && (S.sel.kind === 'layer' || S.sel.kind === 'group')) { duplicateLayer(S.sel.id, true); }
  const b = itemBox(S.sel);
  S.drag = { type: 'move', sel: { ...S.sel }, p0: pt, orig: getPos(S.sel), a0: aabb(b), moved: false };
  ui.setPointerCapture(e.pointerId);
});

/* Déplacement d'une sélection multiple (Alt : en dupliquant les calques) */
function startMultiMove(pt, dup, hit) {
  if (dup) {
    const copies = [];
    for (const s of moveList()) {
      if (s.kind === 'el') { copies.push(s); continue; }
      duplicateLayer(s.id, true);
      copies.push(S.sel);
    }
    S.sels = copies; S.sel = copies[copies.length - 1];
    renderLayers();
  }
  const list = moveList().filter(s => !isLocked(s));
  const mb = multiBox();
  S.drag = { type: 'mmove', list, origs: list.map(getPos), p0: pt, a0: aabb(mb), moved: false, hit };
}
/* Agrandir une sélection multiple par les poignées d'angle (calques et éléments de l'overlay) */
function startMultiScale(pt) {
  const mb = multiBox();
  if (!mb) return;
  const m0 = [], e0 = [];
  for (const s of moveList().filter(x => !isLocked(x))) {
    if (s.kind === 'el') {
      const b = S.boxes.get(s.id), d = elData(s.id);
      if (b) e0.push({ id: s.id, cx: b.cx, cy: b.cy, x: d.x || 0, y: d.y || 0, s: d.s ?? 1 });
    } else (s.kind === 'group' ? membersOf(s.id) : [layerById(s.id)]).forEach(L => m0.push({ id: L.id, x: L.x, y: L.y, w: L.w, h: L.h, ts: L.text && L.text.size }));
  }
  S.drag = { type: 'gscale', c: { x: mb.cx, y: mb.cy }, d0: Math.hypot(pt.x - mb.cx, pt.y - mb.cy) || 1, m0, e0 };
}
function marqueeRect(d, pt) {
  return { l: Math.min(d.p0.x, pt.x), t: Math.min(d.p0.y, pt.y), r: Math.max(d.p0.x, pt.x), b: Math.max(d.p0.y, pt.y) };
}
/* tout ce que le rectangle touche (un calque de dossier replié → le dossier) */
function marqueeHits(R) {
  const out = [];
  for (const it of items()) {
    const a = aabb(it.box);
    if (a.r < R.l || a.l > R.r || a.b < R.t || a.t > R.b) continue;
    let s = { kind: it.kind, id: it.id };
    if (it.kind === 'layer') { const g = groupOf(layerById(it.id)); if (g && !g.open) s = { kind: 'group', id: g.id }; }
    if (!out.some(o => sameSel(o, s))) out.push(s);
  }
  return out;
}

ui.addEventListener('pointermove', e => {
  const pt = toCanvas(e.clientX, e.clientY);
  $('#st-cursor').textContent = `X ${Math.round(pt.x)} · Y ${Math.round(pt.y)}`;
  const d = S.drag;
  if (!d) { renderHover(hitTest(pt)); return; }
  if (d.type === 'pan') {
    S.panX = d.px + (e.clientX - d.x); S.panY = d.py + (e.clientY - d.y); S.autoFit = false;
    applyView(); return;
  }
  if (d.type === 'guide') {
    const r = stageRect();
    const out = d.d === 'v' ? e.clientX < r.left : e.clientY < r.top;
    const v = d.d === 'v' ? round(pt.x) : round(pt.y);
    const arr = S.p.guides[d.d];
    if (d.i < 0) { arr.push(v); d.i = arr.length - 1; } else arr[d.i] = v;
    drawGuides();
    $$('.guide', $('#guides-layer')).forEach(gd => gd.classList.toggle('ghost', out && gd.dataset.g === d.d && +gd.dataset.i === d.i));
    d.out = out;
    tip(out ? 'Relâche pour supprimer' : `${d.d === 'v' ? 'X' : 'Y'} ${v}`, e.clientX, e.clientY);
    return;
  }
  if (d.type === 'move') {
    let dx = pt.x - d.p0.x, dy = pt.y - d.p0.y;
    if (!d.moved && Math.hypot(dx, dy) * S.zoom < 2) return;
    d.moved = true;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    const r = snapMove(d.a0, dx, dy, d.sel, e);
    setPos(d.sel, d.orig.x + r.dx, d.orig.y + r.dy);
    drawSmart(r.guides);
    tip(`X ${Math.round(d.a0.l + r.dx)} · Y ${Math.round(d.a0.t + r.dy)}`, e.clientX, e.clientY);
    schedule('css'); refreshFields(); renderSel(); drawRulers();
    return;
  }
  if (d.type === 'mmove') {
    let dx = pt.x - d.p0.x, dy = pt.y - d.p0.y;
    if (!d.moved && Math.hypot(dx, dy) * S.zoom < 2) return;
    d.moved = true;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    const r = snapMove(d.a0, dx, dy, selList(), e);
    d.list.forEach((s, i) => setPos(s, d.origs[i].x + r.dx, d.origs[i].y + r.dy));
    drawSmart(r.guides);
    tip(`X ${Math.round(d.a0.l + r.dx)} · Y ${Math.round(d.a0.t + r.dy)}`, e.clientX, e.clientY);
    schedule('css'); refreshFields(); renderSel(); drawRulers();
    return;
  }
  if (d.type === 'marquee') {
    const R = marqueeRect(d, pt), m = $('#marquee');
    Object.assign(m.style, { display: 'block', left: sx(R.l) + 'px', top: sy(R.t) + 'px', width: (R.r - R.l) * S.zoom + 'px', height: (R.b - R.t) * S.zoom + 'px' });
    d.last = pt;
    return;
  }
  if (['resize', 'scale', 'rotate', 'gscale', 'skew', 'distort'].includes(d.type)) { doTransform(d, pt, e); }
});

function endDrag(e) {
  const d = S.drag;
  if (!d) return;
  S.drag = null;
  vp.classList.remove('panning');
  drawSmart(null); tip(null);
  if (d.type === 'guide') {
    if (d.out && d.i >= 0) S.p.guides[d.d].splice(d.i, 1);
    drawGuides(); commit();
    return;
  }
  if (d.type === 'marquee') {
    $('#marquee').style.display = 'none';
    const pt = d.last || d.p0, R = marqueeRect(d, pt);
    if ((R.r - R.l) * S.zoom < 4 && (R.b - R.t) * S.zoom < 4) { if (!d.add) select(null); return; }
    const hits = marqueeHits(R);
    const list = d.add ? [...selList(), ...hits.filter(x => !isSelected(x))] : hits;
    select(list[list.length - 1] || null, { list });
    return;
  }
  if (d.type === 'mmove' && !d.moved) {
    /* simple clic sans glisser : Maj/Ctrl → retirer l'élément · sinon → ne garder que lui */
    if (d.hit && d.hit.toggleOff) select({ kind: d.hit.kind, id: d.hit.id }, { toggle: true });
    else if (d.hit) select({ kind: d.hit.kind, id: d.hit.id });
    return;
  }
  if (d.type === 'move' && !d.moved) return;
  if (d.type !== 'pan') { commit(); refreshFields(); drawRulers(); }
}
ui.addEventListener('pointerup', endDrag);
ui.addEventListener('pointercancel', endDrag);
ui.addEventListener('pointerleave', () => { if (!S.drag) renderHover(null); });
ui.addEventListener('dblclick', e => {
  const it = hitTest(toCanvas(e.clientX, e.clientY));
  if (it && it.kind === 'layer') {
    const L = layerById(it.id);
    if (L && L.type === 'text') { setTab('props'); setTimeout(() => { const ta = $('#insp-text'); if (ta) { ta.focus(); ta.select(); } }, 30); }
  }
});

/* Redimensionner / mettre à l'échelle / pivoter */
function startTransform(h, e, pt) {
  const sel = { ...S.sel }, b = itemBox(sel);
  if (!b) return;
  if (sel.kind === 'group') {
    if (h === 'rot') return;
    S.drag = { type: 'gscale', sel, c: { x: b.cx, y: b.cy }, d0: Math.hypot(pt.x - b.cx, pt.y - b.cy) || 1,
      m0: membersOf(sel.id).map(L => ({ id: L.id, x: L.x, y: L.y, w: L.w, h: L.h, ts: L.text && L.text.size })) };
  } else if (h === 'rot') {
    S.drag = { type: 'rotate', sel, c: { x: b.cx, y: b.cy }, a0: Math.atan2(pt.y - b.cy, pt.x - b.cx), r0: sel.kind === 'layer' ? (layerById(sel.id).r || 0) : (elData(sel.id).r || 0) };
  } else if (sel.kind === 'el') {
    const d = elData(sel.id);
    S.drag = { type: 'scale', sel, c: { x: b.cx, y: b.cy }, d0: Math.hypot(pt.x - b.cx, pt.y - b.cy) || 1, s0: d.s ?? 1 };
  } else {
    const L = layerById(sel.id);
    const side = ['n', 's', 'e', 'w'].includes(h);
    /* formes : Ctrl (ou Maj) + côté = incliner, Ctrl + coin = déformer (comme la transformation de Photoshop) */
    if (L.type === 'shape' && side && (e.ctrlKey || e.shiftKey)) {
      const sh = L.shape;
      S.drag = { type: 'skew', sel, h, p0: pt, L0: { x: L.x, y: L.y, w: L.w, h: L.h }, sk0: { x: sh.skx || 0, y: sh.sky || 0 } };
      return;
    }
    if (L.type === 'shape' && !side && e.ctrlKey) {
      const sh = L.shape;
      if (!(sh.kind === 'custom' && Array.isArray(sh.pts) && sh.pts.length === 4)) {
        const pp = polyPts(sh);
        sh.pts = pp && pp.length === 4 ? pp.map(q => [q[0], q[1]]) : [[0, 0], [100, 0], [100, 100], [0, 100]];
        sh.kind = 'custom';
        renderInspector();   // les cases des 4 coins apparaissent tout de suite
      }
      const idx = { nw: 0, ne: 1, se: 2, sw: 3 }[h];
      /* écart entre la souris et le coin réel : le coin ne saute pas sous le curseur */
      const a = (L.r || 0) * Math.PI / 180, q = sh.pts[idx];
      const lx = q[0] / 100 * L.w - L.w / 2, ly = q[1] / 100 * L.h - L.h / 2;
      const cxw = L.x + L.w / 2 + lx * Math.cos(a) - ly * Math.sin(a), cyw = L.y + L.h / 2 + lx * Math.sin(a) + ly * Math.cos(a);
      S.drag = { type: 'distort', sel, idx, off: { x: cxw - pt.x, y: cyw - pt.y } };
      return;
    }
    S.drag = { type: 'resize', sel, h, p0: pt, L0: { x: L.x, y: L.y, w: L.w, h: L.h, r: L.r || 0 }, ratio: L.w / L.h };
  }
}
function doTransform(d, pt, e) {
  if (d.type === 'skew' || d.type === 'distort') {
    const L = layerById(d.sel.id), sh = L.shape, a = (L.r || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    if (d.type === 'skew') {
      /* le côté tiré suit la souris, le côté opposé reste en place (on décale le calque de la moitié) */
      const o = d.L0, wx = pt.x - d.p0.x, wy = pt.y - d.p0.y;
      const lx = wx * cos + wy * sin, ly = -wx * sin + wy * cos;
      const vert = d.h === 'n' || d.h === 's', sign = d.h === 'n' || d.h === 'w' ? -1 : 1;
      const t0 = Math.tan((vert ? d.sk0.x : d.sk0.y) * Math.PI / 180);
      let deg = Math.atan(t0 + sign * (vert ? lx / o.h : ly / o.w)) * 180 / Math.PI;
      if (e.shiftKey && e.ctrlKey) deg = Math.round(deg / 15) * 15;
      deg = clamp(round(deg, 1), -75, 75);
      const dTan = Math.tan(deg * Math.PI / 180) - t0;
      const shift = sign * (vert ? o.h : o.w) / 2 * dTan;
      if (vert) { sh.skx = deg; L.x = round(o.x + shift * cos, 1); L.y = round(o.y + shift * sin, 1); }
      else { sh.sky = deg; L.x = round(o.x - shift * sin, 1); L.y = round(o.y + shift * cos, 1); }
      if (!sh.skx) delete sh.skx;
      if (!sh.sky) delete sh.sky;
      tip(`Inclinaison ${deg}°`, e.clientX, e.clientY);
    } else {
      /* coin déplacé dans le cadre du calque (en %). Aimanté aux bords et au milieu seulement à ~5 px
         à l'écran (avant : 4 % de la forme, soit des dizaines de px sur une forme large → impossible
         de faire un petit angle) ; aimants coupés avec le bouton Aimants ou Alt */
      const off = d.off || { x: 0, y: 0 };
      const rx = pt.x + off.x - (L.x + L.w / 2), ry = pt.y + off.y - (L.y + L.h / 2);
      const lx = rx * cos + ry * sin, ly = -rx * sin + ry * cos;
      let px = clamp((lx + L.w / 2) / L.w * 100, 0, 100), py = clamp((ly + L.h / 2) / L.h * 100, 0, 100);
      if (S.snap && !e.altKey) {
        const tx = 5 / Math.max(1, L.w * S.zoom) * 100, ty = 5 / Math.max(1, L.h * S.zoom) * 100;
        for (const v of [0, 50, 100]) { if (Math.abs(px - v) < tx) px = v; if (Math.abs(py - v) < ty) py = v; }
      }
      sh.pts[d.idx] = [round(px, 1), round(py, 1)];
      tip(`Coin ${round(px, 1)} % · ${round(py, 1)} %${S.snap && !e.altKey ? ' — Alt : sans aimant' : ''}`, e.clientX, e.clientY);
    }
    schedule('css'); refreshFields(); renderSel();
    return;
  }
  if (d.type === 'gscale') {
    /* dossier : tous ses calques mis à l'échelle autour du centre (positions, tailles, textes) */
    let s = Math.hypot(pt.x - d.c.x, pt.y - d.c.y) / d.d0;
    if (e.shiftKey) s = Math.round(s * 20) / 20; else if (Math.abs(s - 1) < .025) s = 1;
    s = clamp(s, .05, 20);
    for (const m of d.m0) {
      const L = layerById(m.id);
      if (!L) continue;
      const cx = d.c.x + (m.x + m.w / 2 - d.c.x) * s, cy = d.c.y + (m.y + m.h / 2 - d.c.y) * s;
      L.w = round(m.w * s, 1); L.h = round(m.h * s, 1); L.x = round(cx - L.w / 2, 1); L.y = round(cy - L.h / 2, 1);
      if (m.ts && L.text) L.text.size = round(m.ts * s, 1);
    }
    for (const m of d.e0 || []) {
      /* élément de l'overlay : échelle multipliée et centre rapproché / éloigné du centre de la sélection */
      const el = elData(m.id);
      el.s = round(clamp(m.s * s, .1, 6), 4);
      el.x = round(m.x + (d.c.x + (m.cx - d.c.x) * s - m.cx), 1);
      el.y = round(m.y + (d.c.y + (m.cy - d.c.y) * s - m.cy), 1);
    }
    tip(`${Math.round(s * 100)} %`, e.clientX, e.clientY);
    schedule('css'); refreshFields(); renderSel();
    return;
  }
  if (d.type === 'rotate') {
    let a = d.r0 + (Math.atan2(pt.y - d.c.y, pt.x - d.c.x) - d.a0) * 180 / Math.PI;
    a = ((a + 540) % 360) - 180;
    if (e.shiftKey) a = Math.round(a / 15) * 15;
    else for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(a - s) < 2.5) a = s;
    if (d.sel.kind === 'layer') layerById(d.sel.id).r = round(a, 1); else elData(d.sel.id).r = round(a, 1);
    tip(`${round(a, 1)}°`, e.clientX, e.clientY);
  } else if (d.type === 'scale') {
    let s = d.s0 * Math.hypot(pt.x - d.c.x, pt.y - d.c.y) / d.d0;
    if (e.shiftKey) s = Math.round(s * 20) / 20;
    else if (Math.abs(s - 1) < .025) s = 1;
    s = clamp(s, .1, 6);
    elData(d.sel.id).s = round(s, 3);
    tip(`${Math.round(s * 100)} %`, e.clientX, e.clientY);
  } else if (d.type === 'resize') {
    const L = layerById(d.sel.id), o = d.L0, h = d.h;
    const xd = h.includes('e') ? 1 : h.includes('w') ? -1 : 0, yd = h.includes('s') ? 1 : h.includes('n') ? -1 : 0;
    const a = o.r * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const dx = pt.x - d.p0.x, dy = pt.y - d.p0.y;
    const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
    const fromCenter = e.altKey;
    let w = o.w + xd * lx * (fromCenter ? 2 : 1), hh = o.h + yd * ly * (fromCenter ? 2 : 1);
    const keep = (e.shiftKey ? !(L.type === 'image' || L.type === 'video' || L.type === 'lottie') : (L.type === 'image' || L.type === 'video' || L.type === 'lottie')) && xd && yd;
    if (keep) { const f = Math.max(w / o.w, hh / o.h); w = o.w * f; hh = o.h * f; }
    w = Math.max(4, w); hh = Math.max(4, hh);
    /* aimants sur les bords déplacés (sans rotation) */
    let guides = [];
    if (!o.r && S.snap && !e.ctrlKey && !fromCenter) {
      const T = d.targets || (d.targets = snapTargets(d.sel)), thr = 7 / S.zoom;
      if (xd) { const edge = xd > 0 ? o.x + w : o.x + o.w - w; const s = snapAxis([edge], T.xs, thr); if (s != null) w += xd * s; }
      if (yd) { const edge = yd > 0 ? o.y + hh : o.y + o.h - hh; const s = snapAxis([edge], T.ys, thr); if (s != null) hh += yd * s; }
      if (keep) { const f = xd ? w / o.w : hh / o.h; w = o.w * f; hh = o.h * f; }
    }
    const cxL = fromCenter ? 0 : xd * (w - o.w) / 2, cyL = fromCenter ? 0 : yd * (hh - o.h) / 2;
    const cx = o.x + o.w / 2 + cxL * cos - cyL * sin, cy = o.y + o.h / 2 + cxL * sin + cyL * cos;
    L.w = round(w, 1); L.h = round(hh, 1); L.x = round(cx - w / 2, 1); L.y = round(cy - hh / 2, 1);
    if (!o.r && S.snap && !e.ctrlKey) { const T = d.targets; const A = aabb(layerBox(L)); collectGuides(A, T, guides); guides = guides.filter(g => (g.d === 'v' && xd) || (g.d === 'h' && yd)); }
    drawSmart(guides);
    tip(`${Math.round(L.w)} × ${Math.round(L.h)}`, e.clientX, e.clientY);
  }
  schedule('css'); refreshFields(); renderSel();
}

/* Molette : zoom (Ctrl) ou navigation */
vp.addEventListener('wheel', e => {
  e.preventDefault();
  const r = stageRect();
  if (e.ctrlKey || e.metaKey) zoomAt(S.zoom * Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top);
  else { S.panX -= e.shiftKey ? e.deltaY : e.deltaX; S.panY -= e.shiftKey ? 0 : e.deltaY; S.autoFit = false; applyView(); }
}, { passive: false });

/* Règles : tirer pour créer un repère */
['top', 'left'].forEach(side => {
  $('#ruler-' + side).addEventListener('pointerdown', e => {
    e.preventDefault();
    S.drag = { type: 'guide', d: side === 'top' ? 'h' : 'v', i: -1 };
    ui.setPointerCapture(e.pointerId);
  });
});
$('#ruler-corner').addEventListener('click', () => {
  if (!S.p.guides.v.length && !S.p.guides.h.length) return;
  S.p.guides = { v: [], h: [] }; drawGuides(); commit(); toast('Repères supprimés');
});

/* ─────────────────────────── Sélection (simple ou multiple) ───────────────────────────
   S.sels = tout ce qui est sélectionné, S.sel = l'élément principal (le dernier cliqué). */
S.sels = [];
const sameSel = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;
const selExists = s => !!s && (s.kind === 'el' ? !!EL[s.id] : !!layerById(s.id));
const selList = () => S.sels.filter(selExists);
const isSelected = it => S.sels.some(s => sameSel(s, it));
const isMulti = () => selList().length > 1;
function setSel(sel) { S.sel = sel || null; S.sels = sel ? [sel] : []; }
/* ce qui bouge vraiment : un calque dont le dossier est aussi sélectionné bouge déjà avec lui */
function moveList() {
  const all = selList();
  return all.filter(s => !(s.kind === 'layer' && all.some(o => o.kind === 'group' && o.id === (layerById(s.id) || {}).group)));
}
function multiBox() {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n = 0;
  for (const s of selList()) {
    const bx = itemBox(s);
    if (!bx) continue;
    const a = aabb(bx); n++;
    l = Math.min(l, a.l); t = Math.min(t, a.t); r = Math.max(r, a.r); b = Math.max(b, a.b);
  }
  return n ? { cx: (l + r) / 2, cy: (t + b) / 2, w: r - l, h: b - t, rot: 0, vis: true } : null;
}
/* opts.toggle : ajoute / retire (Maj ou Ctrl+clic) · opts.list : remplace par une liste */
function select(sel, opts = {}) {
  if (opts.list) { S.sels = opts.list.filter(selExists); S.sel = sel || S.sels[S.sels.length - 1] || null; }
  else if (opts.toggle && sel) {
    if (isSelected(sel)) { S.sels = S.sels.filter(s => !sameSel(s, sel)); S.sel = S.sels[S.sels.length - 1] || null; }
    else { S.sels = [...selList(), sel]; S.sel = sel; }
  } else setSel(sel);
  if (sel && S.sels.length === 1) {
    if (sel.kind === 'el') {
      const E = EL[sel.id];
      if (!sceneShowsElement(E)) setScene(E.scene, true);
    } else {
      const L = layerById(sel.id);
      /* calque invisible dans la scène affichée : on passe à la scène de son premier moment */
      const gs = L && isGroup(L) ? groupShow(L) : null, f = F();
      const want = gs ? (f && !f.isShown(gs) ? SHOW_SCENE[gs[0]] : null)
        : L && !isGroup(L) && !effHidden(L) && !layerVisibleInScene(L) ? SHOW_SCENE[(groupShow(groupOf(L)) || showList(L)).find(m => m !== 'always') || 'always'] : null;
      if (want && want !== S.scene) setScene(want, true);
    }
  }
  forceOptional();
  if (!opts.keepTab && sel && S.tab === 'theme') S.tab = 'props';
  S.kfSel = 0;
  renderLayers(); renderInspector(); renderSel(); drawRulers();
}
/* Bandeau médias / flux vidéo : affichés le temps de les placer */
function forceOptional() {
  const doc = FD();
  if (!doc) return;
  if (S.forced) { const el = elNode(doc, EL[S.forced.key]); if (el && S.forced.added) el.classList.remove(S.forced.cls); S.forced = null; }
  if (S.sel && S.sel.kind === 'el' && EL[S.sel.id].optional) {
    const E = EL[S.sel.id], el = elNode(doc, E);
    if (el && !el.classList.contains(E.optional)) { el.classList.add(E.optional); S.forced = { key: E.key, cls: E.optional, added: true }; }
  }
}

function setScene(sc, silent) {
  S.scene = sc;
  $$('#scenes button').forEach(b => b.classList.toggle('on', b.dataset.scene === sc));
  const f = F();
  if (f) f.setScene(sc, { winner: S.pvWin || 0 });
  if (!silent) {
    S.sels = selList().filter(s => s.kind !== 'el' || sceneShowsElement(EL[s.id]));
    if (S.sel && !isSelected(S.sel)) S.sel = S.sels[S.sels.length - 1] || null;
    renderLayers(); renderInspector();
  }
  setTimeout(renderSel, 80);
}

/* ─────────────────────────── Calques : ajout, duplication, suppression ─────────────────────────── */
const DEFAULT_ANIM = () => ({ in: 'fade', inDur: .5, inDelay: 0, inEase: 'smooth', loop: 'none', loopDur: 2, out: 'fade', outDur: .35 });
async function uploadBlob(blob, name) {
  const r = await fetch('/api/studio/asset', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'Envoi du fichier impossible');
  S.p.assets[j.id] = { file: j.file, name, size: j.size };
  return j.id;
}
function pickFile(accept) {
  return new Promise(res => {
    const inp = $('#file-pick');
    inp.value = ''; inp.accept = accept || '';
    inp.onchange = () => res(inp.files[0] || null);
    inp.click();
  });
}
function mediaSize(file, kind) {
  return new Promise(res => {
    const url = URL.createObjectURL(file);
    const done = (w, h) => { URL.revokeObjectURL(url); res({ w: w || 400, h: h || 225 }); };
    if (kind === 'video') { const v = document.createElement('video'); v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight); v.onerror = () => done(); v.src = url; }
    else if (kind === 'lottie') { file.text().then(t => { try { const j = JSON.parse(t); done(j.w, j.h); } catch (e) { done(); } }); }
    else { const i = new Image(); i.onload = () => done(i.naturalWidth, i.naturalHeight); i.onerror = () => done(); i.src = url; }
  });
}
const ACCEPT = {
  image: '.png,.jpg,.jpeg,.webp,.svg,.gif',
  video: '.webm,.mp4,.mov,.gif,.webp,.apng',
  lottie: '.json',
  font: '.ttf,.otf,.woff,.woff2',
};
function kindOfFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['webm', 'mp4', 'mov'].includes(ext)) return 'video';
  if (ext === 'json') return 'lottie';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'apng'].includes(ext)) return 'image';
  if (ext === 'css') return 'css';
  if (ext === 'zip') return 'zip';
  if (ext === 'rlstudio') return 'project';
  return null;
}
async function addLayer(kind, file, at) {
  const L = { id: 'l' + uid(), name: '', type: kind, x: 0, y: 0, w: 400, h: 225, r: 0, o: 100, show: [...DEFAULT_SHOW], z: 'front', anim: DEFAULT_ANIM() };
  if (kind === 'text') {
    Object.assign(L, { name: 'Texte', w: 520, h: 110, text: { content: 'MON TEXTE', font: 'Barlow Condensed', size: 72, weight: 800, color: '#ffffff', align: 'center', spacing: 2, upper: true, italic: false, stroke: { w: 0, color: '#000000' }, glow: { size: 0, color: '#3d7bff' }, grad: { on: false, color2: '#7aa8ff', angle: 90 } } });
  } else if (kind === 'shape') {
    Object.assign(L, { name: 'Forme', w: 420, h: 120, shape: { kind: 'rect', fill: '#3d7bff', radius: 14, grad: { on: false, color2: '#9b5cff', angle: 135 }, border: { w: 0, color: '#ffffff' }, glow: { size: 0, color: '#3d7bff' } } });
  } else if (kind === 'logo') {
    Object.assign(L, { name: 'Logo équipe bleue', team: 'blue', w: 180, h: 180, fit: 'contain' });
  } else if (kind === 'series') {
    Object.assign(L, { name: 'Série équipe bleue', w: 200, h: 16, series: { team: 'blue', style: 'rects', dir: 'ltr', gap: 6, radius: 3, bw: 8, off: 'rgba(255,255,255,0.16)' } });
  } else if (kind === 'boost') {
    /* même place que le boost meter d'origine, qui est masqué (réaffichable avec l'œil) */
    const ob = S.boxes.get('boost-meter');
    Object.assign(L, { name: 'Jauge de boost', w: 360, h: 36, boost: { style: 'bar', num: 'center', numSize: 26, radius: 8, bw: 9, segs: 10, gap: 4 } });
    if (ob && !at) at = { x: ob.cx, y: ob.cy };
    elData('boost-meter').hidden = true;
    setTimeout(() => toast('Boost meter d\'origine masqué — la jauge le remplace (réaffichable avec l\'œil)'), 300);
  } else if (kind === 'media') {
    /* même taille et même place que le bandeau d'origine, qui est masqué (réaffichable avec l'œil) */
    const ob = S.boxes.get('media-banner'), om = (S.p.elements['media-banner'] || {}).mb || {};
    Object.assign(L, { name: 'Bandeau médias', w: om.w || 210, h: om.h || 100, media: { bg: om.bg ?? 'rgba(0,0,0,0.27)', radius: om.radius ?? 8, pad: om.pad ?? 10, fit: om.fit || 'contain', vfit: om.vfit || 'cover' } });
    if (ob && !at) at = { x: ob.cx, y: ob.cy };
    elData('media-banner').hidden = true;
    setTimeout(() => toast('Bandeau d\'origine masqué — le calque le remplace (réaffichable avec l\'œil)'), 300);
  } else {
    if (!file) file = await pickFile(ACCEPT[kind]);
    if (!file) return;
    const real = kindOfFile(file);
    if (!real || real === 'font' || real === 'css') { toast('Type de fichier non pris en charge', 'err'); return; }
    kind = real; L.type = real;
    busy(true, 'Import du fichier…');
    try { L.asset = await uploadBlob(file, file.name); }
    catch (e) { busy(false); toast(e.message, 'err'); return; }
    busy(false);
    const sz = await mediaSize(file, kind);
    let w = sz.w, h = sz.h;
    if (w >= 1280 && Math.abs(w / h - 16 / 9) < .02) { w = W; h = H; }
    else { const k = Math.min(1, 640 / w, 480 / h); w *= k; h *= k; }
    Object.assign(L, { name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), w: round(w), h: round(h), fit: 'contain', loop: true });
    if (L.w === W && L.h === H) L.anim.in = 'fade';
  }
  const cx = at ? at.x : W / 2, cy = at ? at.y : H / 2;
  L.x = round(clamp(cx - L.w / 2, -L.w / 2, W - L.w / 2)); L.y = round(clamp(cy - L.h / 2, -L.h / 2, H - L.h / 2));
  if (L.w === W && L.h === H) { L.x = 0; L.y = 0; }
  if (S.scene !== 'game' && SHOW_SCENE[S.scene]) L.show = [S.scene];
  insertLayer(L);
  schedule('layers');
  select({ kind: 'layer', id: L.id });
  changed('layers', { commit: 'now' });
}
function duplicateLayer(id, inPlace) {
  const L = layerById(id);
  if (!L) return;
  const off = inPlace ? 0 : 24;
  if (isGroup(L)) {
    /* dossier : copie du dossier et de tous ses calques, juste au-dessus */
    const g = { ...clone(L), id: 'g' + uid(), name: (L.name || 'Dossier') + ' copie' };
    const ms = membersOf(L.id).map(m => ({ ...clone(m), id: 'l' + uid(), group: g.id, x: m.x + off, y: m.y + off }));
    S.p.layers.splice(S.p.layers.indexOf(L), 0, g, ...ms);
    setSel({ kind: 'group', id: g.id });
  } else {
    const c = clone(L);
    c.id = 'l' + uid(); c.name = (L.name || 'Calque') + ' copie';
    c.x += off; c.y += off;
    S.p.layers.splice(S.p.layers.indexOf(L), 0, c);
    setSel({ kind: 'layer', id: c.id });
  }
  normalizeGroups();
  changed('layers', { layers: true, inspector: true, commit: inPlace ? false : 'now' });
}
function deleteSelection() {
  if (!S.sel) return;
  if (isMulti()) {
    let hidden = 0;
    for (const s of selList()) {
      if (s.kind === 'el') { elData(s.id).hidden = true; hidden++; }
      else S.p.layers = S.p.layers.filter(x => x.id !== s.id && (s.kind !== 'group' || x.group !== s.id));
    }
    setSel(null);
    changed('layers', { layers: true, inspector: true, commit: 'now' });
    if (hidden) toast(`${hidden} élément${hidden > 1 ? 's' : ''} de l'overlay masqué${hidden > 1 ? 's' : ''} (réaffichables avec l'œil)`);
    return;
  }
  if (S.sel.kind === 'group') {
    const gid = S.sel.id;
    S.p.layers = S.p.layers.filter(x => x.id !== gid && x.group !== gid);
    setSel(null);
    changed('layers', { layers: true, inspector: true, commit: 'now' });
  } else if (S.sel.kind === 'layer') {
    S.p.layers = S.p.layers.filter(L => L.id !== S.sel.id);
    setSel(null);
    changed('layers', { layers: true, inspector: true, commit: 'now' });
  } else {
    elData(S.sel.id).hidden = true;
    changed('css', { layers: true, inspector: true, commit: 'now' });
    toast(`« ${EL[S.sel.id].label} » masqué — réaffiche-le avec l'œil dans les calques`);
  }
}
/* Premier plan / arrière-plan / monter / descendre : un calque de dossier bouge dans son dossier,
   un dossier bouge avec tout son contenu */
function moveLayer(id, where) {
  const x = layerById(id);
  if (!x) return;
  const pos = (i, len) => where === 'top' ? 0 : where === 'bottom' ? len : where === 'up' ? Math.max(0, i - 1) : Math.min(len, i + 1);
  if (!isGroup(x) && x.group) {
    const ms = membersOf(x.group), i = ms.indexOf(x);
    ms.splice(i, 1); ms.splice(pos(i, ms.length), 0, x);
    const rest = S.p.layers.filter(L => isGroup(L) || L.group !== x.group);
    rest.splice(rest.indexOf(groupById(x.group)) + 1, 0, ...ms);
    S.p.layers = rest;
  } else {
    const units = S.p.layers.filter(L => isGroup(L) || !L.group).map(blockOf);
    const i = units.findIndex(u => u[0] === x), [u] = units.splice(i, 1);
    units.splice(pos(i, units.length), 0, u);
    S.p.layers = units.flat();
  }
  changed('layers', { layers: true, commit: 'now' });
}
/* Ctrl+G : range le calque sélectionné dans un nouveau dossier (ou crée un dossier vide) */
function groupSelection() {
  const n = S.p.layers.filter(isGroup).length + 1;
  const g = { id: 'g' + uid(), type: 'group', name: `Dossier ${n}`, open: true };
  if (isMulti()) {
    /* plusieurs calques (et dossiers, fusionnés) → un seul nouveau dossier, à la place du plus haut */
    const sels = selList(), dissolve = sels.filter(s => s.kind === 'group').map(s => s.id);
    let layers = [];
    for (const s of sels) {
      if (s.kind === 'layer') layers.push(layerById(s.id));
      else if (s.kind === 'group') layers.push(...membersOf(s.id));
    }
    layers = [...new Set(layers)].sort((a, b) => S.p.layers.indexOf(a) - S.p.layers.indexOf(b));
    if (!layers.length) { toast('Les éléments de l\'overlay ne se rangent pas dans un dossier', 'err'); return; }
    const first = layers[0], anchor = first.group ? groupById(first.group) : first;
    S.p.layers.splice(S.p.layers.indexOf(anchor), 0, g);
    S.p.layers = S.p.layers.filter(x => !layers.includes(x) && !dissolve.includes(x.id));
    layers.forEach(L => { L.group = g.id; });
    S.p.layers.splice(S.p.layers.indexOf(g) + 1, 0, ...layers);
    normalizeGroups();
    setSel({ kind: 'group', id: g.id });
    changed('layers', { layers: true, inspector: true, commit: 'now' });
    toast(`${layers.length} calques rangés dans ${g.name}${sels.some(s => s.kind === 'el') ? ' (éléments de l\'overlay ignorés)' : ''}`);
    return;
  }
  const L = S.sel && S.sel.kind === 'layer' ? layerById(S.sel.id) : null;
  if (L) {
    const anchor = L.group ? groupById(L.group) : L;
    S.p.layers.splice(S.p.layers.indexOf(anchor), 0, g);
    L.group = g.id;
    const i = S.p.layers.indexOf(L); S.p.layers.splice(i, 1); S.p.layers.splice(S.p.layers.indexOf(g) + 1, 0, L);
  } else S.p.layers.unshift(g);
  normalizeGroups();
  setSel({ kind: 'group', id: g.id });
  changed('layers', { layers: true, inspector: true, commit: 'now' });
  toast(L ? `« ${L.name} » rangé dans ${g.name}` : `${g.name} créé — glisse des calques dessus`);
}
/* Ctrl+Maj+G : dissocier (les calques restent à leur place) */
function ungroup(gid) {
  const g = groupById(gid);
  if (!g) return;
  const ms = membersOf(gid);
  ms.forEach(L => delete L.group);
  S.p.layers.splice(S.p.layers.indexOf(g), 1);
  normalizeGroups();
  setSel(ms[0] ? { kind: 'layer', id: ms[0].id } : null);
  changed('layers', { layers: true, inspector: true, commit: 'now' });
}
function leaveGroup(id) {
  const L = layerById(id);
  if (!L || !L.group) return;
  const g = groupById(L.group);
  delete L.group;
  S.p.layers.splice(S.p.layers.indexOf(L), 1);
  S.p.layers.splice(S.p.layers.indexOf(g), 0, L);
  normalizeGroups();
  changed('layers', { layers: true, inspector: true, commit: 'now' });
}
/* ── Sélection multiple : aligner, répartir, dupliquer, grouper, masquer, verrouiller ── */
function alignMulti(k) {
  const list = moveList().filter(s => !isLocked(s));
  const mb = multiBox();
  if (!mb) return;
  const U = S.alignTo === 'canvas' ? { l: 0, t: 0, r: W, b: H, cx: W / 2, cy: H / 2 } : aabb(mb);
  for (const s of list) {
    const bx = itemBox(s);
    if (!bx) continue;
    const a = aabb(bx);
    let dx = 0, dy = 0;
    if (k === 'l') dx = U.l - a.l; if (k === 'c') dx = U.cx - a.cx; if (k === 'r') dx = U.r - a.r;
    if (k === 't') dy = U.t - a.t; if (k === 'm') dy = U.cy - a.cy; if (k === 'b') dy = U.b - a.b;
    const p = getPos(s); setPos(s, p.x + dx, p.y + dy);
  }
  changed('css', { commit: 'now' });
}
/* espaces égaux entre les éléments (les deux extrêmes ne bougent pas) */
function distribute(axis) {
  const list = moveList().filter(s => !isLocked(s)).map(s => ({ s, a: aabb(itemBox(s) || { cx: 0, cy: 0, w: 0, h: 0 }) }));
  if (list.length < 3) return;
  const lo = axis === 'h' ? 'l' : 't', hi = axis === 'h' ? 'r' : 'b';
  list.sort((p, q) => p.a[lo] - q.a[lo]);
  const start = list[0].a[lo], end = Math.max(...list.map(x => x.a[hi]));
  const total = list.reduce((t, x) => t + x.a[hi] - x.a[lo], 0), gap = (end - start - total) / (list.length - 1);
  let cur = start;
  for (const x of list) {
    const dd = cur - x.a[lo], p = getPos(x.s);
    setPos(x.s, p.x + (axis === 'h' ? dd : 0), p.y + (axis === 'v' ? dd : 0));
    cur += x.a[hi] - x.a[lo] + gap;
  }
  changed('css', { commit: 'now' });
}
function duplicateSelected() {
  const src = moveList().filter(s => s.kind !== 'el');
  if (!src.length) return;
  const copies = [];
  for (const s of src) { duplicateLayer(s.id); copies.push(S.sel); }
  select(copies[copies.length - 1], { list: copies });
}
function setFlag(flag, on) {
  for (const s of selList()) {
    const o = s.kind === 'el' ? elData(s.id) : layerById(s.id);
    if (!o) continue;
    if (on) o[flag] = true; else delete o[flag];
  }
  changed('layers', { layers: true, inspector: true, commit: 'now' });
}
function selectAll() {
  const list = S.p.layers.filter(x => isGroup(x) || !x.group).map(x => ({ kind: isGroup(x) ? 'group' : 'layer', id: x.id }));
  if (list.length) select(list[list.length - 1], { list });
}
function copySelection() {
  S.clip = moveList().filter(s => s.kind !== 'el').map(s => clone(blockOf(layerById(s.id))));
  if (S.clip.length) toast(`${S.clip.length} élément${S.clip.length > 1 ? 's' : ''} copié${S.clip.length > 1 ? 's' : ''}`);
}
function pasteClip() {
  if (!S.clip || !S.clip.length) return;
  const pasted = [];
  for (const block of [...S.clip].reverse()) {
    const map = {}, items = clone(block).map(x => {
      const nid = (isGroup(x) ? 'g' : 'l') + uid();
      map[x.id] = nid;
      return { ...x, id: nid };
    });
    items.forEach(x => { if (x.group) { if (map[x.group]) x.group = map[x.group]; else delete x.group; } if (!isGroup(x)) { x.x += 24; x.y += 24; } });
    S.p.layers.unshift(...items);
    pasted.unshift({ kind: isGroup(items[0]) ? 'group' : 'layer', id: items[0].id });
  }
  normalizeGroups();
  select(pasted[pasted.length - 1], { list: pasted });
  changed('layers', { layers: true, inspector: true, commit: 'now' });
}

function alignSel(how) {
  if (isMulti()) return alignMulti(how);
  if (!S.sel) return;
  const a = selectedAabb();
  if (!a) return;
  let dx = 0, dy = 0;
  if (how === 'l') dx = -a.l; if (how === 'c') dx = W / 2 - a.cx; if (how === 'r') dx = W - a.r;
  if (how === 't') dy = -a.t; if (how === 'm') dy = H / 2 - a.cy; if (how === 'b') dy = H - a.b;
  const p = getPos(S.sel);
  setPos(S.sel, p.x + dx, p.y + dy);
  changed('css', { commit: 'now' });
}
function nudge(dx, dy) {
  const list = (isMulti() ? moveList() : (S.sel ? [S.sel] : [])).filter(s => !isLocked(s));
  if (!list.length) return;
  list.forEach(s => { const p = getPos(s); setPos(s, p.x + dx, p.y + dy); });
  changed('css', { commit: 400 });
}

/* Glisser-déposer de fichiers sur le canevas */
vp.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); vp.classList.add('dragover'); } });
vp.addEventListener('dragleave', e => { if (e.target === vp || !vp.contains(e.relatedTarget)) vp.classList.remove('dragover'); });
vp.addEventListener('drop', async e => {
  e.preventDefault(); vp.classList.remove('dragover');
  const files = [...e.dataTransfer.files];
  const pt = toCanvas(e.clientX, e.clientY);
  for (const f of files) {
    const k = kindOfFile(f);
    if (k === 'font') await importFont(f);
    else if (k === 'css') await importAnimCss(f);
    else if (k === 'zip') { importZip(f); return; }
    else if (k === 'project') { openProjectFile(f); return; }
    else if (k) await addLayer(k, f, pt);
    else toast(`${f.name} : type non pris en charge`, 'err');
  }
});

/* ─────────────────────────── Panneau des calques ─────────────────────────── */
function layerIcon(L) {
  if (L.type === 'image' && fileOf(L.asset)) return `<div class="l-ico"><img src="/studio-work/${fileOf(L.asset)}" alt=""></div>`;
  if (L.type === 'shape') { const sh = L.shape || {}; return `<div class="l-ico"><div style="width:13px;height:13px;border-radius:${sh.kind === 'ellipse' ? '50%' : '3px'};background:${esc(sh.fill || '#3d7bff')}"></div></div>`; }
  return `<div class="l-ico">${icon({ video: 'video', text: 'text', lottie: 'sparkle', logo: 'shield', media: 'media', series: 'pips', boost: 'gauge' }[L.type] || 'image')}</div>`;
}
function renderLayers() {
  const box = $('#layer-list');
  const sc = S.scene;
  const n = realLayers().length;
  let h = `<div class="ll-group">${icon('layers')}Calques ajoutés<span>${n}</span><button class="ll-add" data-act="new-group" title="Nouveau dossier (Ctrl+G)">${icon('folderPlus')}</button></div>`;
  if (!S.p.layers.length) h += `<div class="ll-empty">Ajoute une image, une vidéo, un texte, une forme, une animation Lottie, un logo d'équipe ou le bandeau médias avec les boutons ci-dessus.</div>`;
  for (const L of S.p.layers) {
    if (isGroup(L)) {
      const sel = isSelected({ kind: 'group', id: L.id });
      const cnt = membersOf(L.id).length;
      h += `<div class="lrow grp${sel ? ' sel' : ''}${L.hidden ? ' off' : ''}" data-kind="group" data-id="${L.id}" draggable="true">
        <button class="l-btn${L.hidden ? '' : ' on'}" data-l-act="eye" title="Afficher / masquer le dossier">${icon(L.hidden ? 'eyeoff' : 'eye')}</button>
        <button class="l-chev${L.open ? '' : ' closed'}" data-l-act="toggle" title="${L.open ? 'Replier' : 'Déplier'}">${icon('chev')}</button>
        <div class="l-ico">${icon(L.open ? 'folderOpen' : 'folder')}</div>
        <div class="l-name">${esc(L.name || 'Dossier')}</div>
        ${groupShow(L) ? `<span class="l-chip${groupShow(L).includes(sc) ? ' hl' : ''}" title="Affiché pendant : ${groupShow(L).map(m => MOMENT_SHORT[m]).join(', ')}">${groupShow(L).map(m => MOMENT_SHORT[m]).join(' · ')}</span>` : ''}
        <span class="l-chip">${cnt}</span>
        <button class="l-btn${L.locked ? ' lock-on' : ''}" data-l-act="lock" title="Verrouiller le dossier">${icon(L.locked ? 'lock' : 'unlock')}</button>
      </div>`;
      if (L.open && !cnt) h += `<div class="lrow in-group ll-hint">Glisse des calques ici</div>`;
      continue;
    }
    const g = groupOf(L);
    if (g && !g.open) continue;
    const sel = isSelected({ kind: 'layer', id: L.id });
    const show = showList(L);
    const chip = show.includes('always') ? 'Toujours' : show.join() === DEFAULT_SHOW.join() ? '' : show.map(m => MOMENT_SHORT[m] || m).join(' · ');
    h += `<div class="lrow${sel ? ' sel' : ''}${effHidden(L) ? ' off' : ''}${g ? ' in-group' : ''}" data-kind="layer" data-id="${L.id}" draggable="true">
      <button class="l-btn${L.hidden ? '' : ' on'}" data-l-act="eye" title="Afficher / masquer">${icon(L.hidden ? 'eyeoff' : 'eye')}</button>
      ${layerIcon(L)}
      <div class="l-name">${esc(L.name || 'Calque')}</div>
      ${chip ? `<span class="l-chip${show.includes(sc) ? ' hl' : ''}">${chip}</span>` : ''}
      ${L.z === 'back' ? '<span class="l-chip" title="Derrière l\'overlay">Arrière</span>' : ''}
      <button class="l-btn${L.locked ? ' lock-on' : ''}" data-l-act="lock" title="Verrouiller">${icon(L.locked ? 'lock' : 'unlock')}</button>
    </div>`;
  }
  h += `<div class="ll-group">${icon('board')}Éléments de l'overlay</div>`;
  for (const E of ELEMENTS) {
    const d = S.p.elements[E.key] || {};
    const sel = isSelected({ kind: 'el', id: E.key });
    const chip = E.scene !== 'game' ? SCENES[E.scene] : '';
    const mod = d.x || d.y || (d.s ?? 1) !== 1 || d.r || elFilter(d) || d.font || (d.loop && d.loop.name && d.loop.name !== 'none');
    h += `<div class="lrow${sel ? ' sel' : ''}${d.hidden ? ' off' : ''}" data-kind="el" data-id="${E.key}">
      <button class="l-btn${d.hidden ? '' : ' on'}" data-l-act="eye" title="Afficher / masquer">${icon(d.hidden ? 'eyeoff' : 'eye')}</button>
      <div class="l-ico">${icon(E.icon)}</div>
      <div class="l-name"${d.name ? ` title="${esc(E.label)}"` : ''}>${esc(d.name || E.label)}${mod ? ' <span style="color:var(--accent-2)">•</span>' : ''}</div>
      ${chip ? `<span class="l-chip${E.scene === sc ? ' hl' : ''}">${chip}</span>` : ''}
      <button class="l-btn${d.locked ? ' lock-on' : ''}" data-l-act="lock" title="Verrouiller">${icon(d.locked ? 'lock' : 'unlock')}</button>
    </div>`;
  }
  box.innerHTML = h;
}
$('#layer-list').addEventListener('click', e => {
  const row = e.target.closest('.lrow');
  if (!row) return;
  const sel = { kind: row.dataset.kind, id: row.dataset.id };
  const act = e.target.closest('[data-l-act]');
  if (!sel.id) return;
  if (act) {
    const obj = sel.kind === 'el' ? elData(sel.id) : layerById(sel.id);
    if (act.dataset.lAct === 'toggle') { obj.open = !obj.open; renderLayers(); commitSoon(); return; }
    if (act.dataset.lAct === 'eye') obj.hidden = !obj.hidden;
    if (act.dataset.lAct === 'lock') obj.locked = !obj.locked;
    if (!obj.hidden) delete obj.hidden;
    if (!obj.locked) delete obj.locked;
    changed(sel.kind === 'el' ? 'css' : 'layers', { layers: true, commit: 'now' });
    return;
  }
  /* Ctrl+clic : ajouter / retirer · Maj+clic : toute la plage depuis le dernier cliqué */
  if (e.ctrlKey || e.metaKey) { select(sel, { toggle: true }); return; }
  /* déjà seul sélectionné (ou 2e clic d'un double-clic) : ne pas redessiner, sinon le double-clic se perd */
  if (e.detail > 1 || (!isMulti() && sameSel(S.sel, sel))) return;
  if (e.shiftKey && S.sel) {
    const rows = $$('#layer-list .lrow[data-id]');
    const i0 = rows.findIndex(r => r.dataset.id === S.sel.id && r.dataset.kind === S.sel.kind), i1 = rows.indexOf(row);
    if (i0 >= 0 && i1 >= 0) {
      const [a, b] = i0 < i1 ? [i0, i1] : [i1, i0];
      select(sel, { list: rows.slice(a, b + 1).map(r => ({ kind: r.dataset.kind, id: r.dataset.id })) });
      return;
    }
  }
  select(sel);
});
/* le premier clic redessine le panneau : on retrouve la ligne par son id, pas par le nœud cliqué */
$('#layer-list').addEventListener('dblclick', e => {
  const row = e.target.closest('.lrow[data-id]');
  if (!row || e.target.closest('[data-l-act]')) return;
  const sel = { kind: row.dataset.kind, id: row.dataset.id };
  if (!isSelected(sel) || isMulti()) select(sel);
  startRename(sel);
});
$('#layer-list').addEventListener('contextmenu', e => {
  const row = e.target.closest('.lrow');
  if (!row) return;
  e.preventDefault();
  const rs = { kind: row.dataset.kind, id: row.dataset.id };
  if (!isSelected(rs)) select(rs);
  openCtx(e.clientX, e.clientY);
});
/* Glisser-déposer : réordonner, ranger dans un dossier (moitié basse d'un dossier = dedans), en sortir.
   Si la ligne attrapée fait partie d'une sélection multiple, TOUTE la sélection suit (dans son ordre). */
let dragRow = null, dragSet = [];
const clearDrop = () => $$('.lrow').forEach(r => r.classList.remove('drop-before', 'drop-after', 'drop-in', 'dragging'));
function dropMode(row, e) {
  const r = row.getBoundingClientRect(), y = e.clientY - r.top;
  if (row.dataset.kind === 'group') {
    if (dragSet.some(isGroup)) return y < r.height / 2 ? 'before' : 'after';   // pas de dossier dans un dossier
    return y < r.height * .3 ? 'before' : 'in';
  }
  return y < r.height / 2 ? 'before' : 'after';
}
/* ce qu'on fait glisser : la sélection (calques + dossiers, sans les éléments de l'overlay) ou la ligne seule */
function draggedItems(rowSel) {
  let items;
  if (isMulti() && isSelected(rowSel)) items = selList().filter(s => s.kind !== 'el').map(s => layerById(s.id)).filter(Boolean);
  else items = [layerById(rowSel.id)].filter(Boolean);
  items = items.filter(x => isGroup(x) || !items.some(g => isGroup(g) && g.id === x.group));
  return items.sort((a, b) => S.p.layers.indexOf(a) - S.p.layers.indexOf(b));
}
/* range des calques (et dossiers) avant / après / dans une cible */
function moveItemsTo(items, target, mode) {
  if (items.some(isGroup) && target.group) target = groupById(target.group);
  if (items.includes(target)) return false;
  if (items.some(isGroup) && mode === 'in') mode = 'after';
  const blocks = [...new Set(items.flatMap(blockOf))];
  S.p.layers = S.p.layers.filter(x => !blocks.includes(x));
  for (const x of items) {
    if (isGroup(x)) continue;
    if (mode === 'in') x.group = target.id;
    else if (isGroup(target)) delete x.group;
    else if (target.group) x.group = target.group; else delete x.group;
  }
  let i = S.p.layers.indexOf(target);
  if (mode === 'in') i += 1;
  else if (mode === 'after') i += isGroup(target) ? blockOf(target).length : 1;
  S.p.layers.splice(i, 0, ...blocks);
  if (mode === 'in') target.open = true;
  normalizeGroups();
  changed('layers', { layers: true, inspector: true, commit: 'now' });
  return true;
}
/* clic droit → « Ranger dans « Dossier » » : tous les calques sélectionnés d'un coup */
function moveSelectionIntoGroup(gid) {
  const g = groupById(gid);
  if (!g) return;
  const items = selList().filter(s => s.kind === 'layer').map(s => layerById(s.id)).filter(L => L && L.group !== gid);
  if (!items.length) return;
  moveItemsTo(items.sort((a, b) => S.p.layers.indexOf(a) - S.p.layers.indexOf(b)), g, 'in');
  toast(`${items.length} calque${items.length > 1 ? 's' : ''} rangé${items.length > 1 ? 's' : ''} dans « ${g.name} »`);
}
$('#layer-list').addEventListener('dragstart', e => {
  const row = e.target.closest('.lrow[data-kind="layer"], .lrow[data-kind="group"]');
  if (!row) return;
  dragRow = row.dataset.id;
  dragSet = draggedItems({ kind: row.dataset.kind, id: row.dataset.id });
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragRow);
  /* les lignes emportées sont grisées ; l'aperçu indique combien */
  const ids = new Set(dragSet.flatMap(blockOf).map(x => x.id));
  requestAnimationFrame(() => { if (dragRow) $$('#layer-list .lrow[data-id]').forEach(r => r.classList.toggle('dragging', ids.has(r.dataset.id))); });
  if (dragSet.length > 1) {
    const ghost = h('div', { class: 'drag-ghost' }, `${dragSet.length} éléments`);
    document.body.append(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => ghost.remove(), 0);
  }
});
$('#layer-list').addEventListener('dragover', e => {
  if (!dragRow) return;
  const row = e.target.closest('.lrow[data-kind="layer"], .lrow[data-kind="group"]');
  $$('.lrow').forEach(r => r.classList.remove('drop-before', 'drop-after', 'drop-in'));
  if (!row) return;
  const target = layerById(row.dataset.id);
  if (!target || dragSet.includes(target) || dragSet.some(g => isGroup(g) && target.group === g.id)) return;
  e.preventDefault();
  row.classList.add('drop-' + dropMode(row, e));
});
$('#layer-list').addEventListener('drop', e => {
  if (!dragRow) return;
  e.preventDefault();
  const row = e.target.closest('.lrow[data-kind="layer"], .lrow[data-kind="group"]');
  const target = row && layerById(row.dataset.id);
  if (target && dragSet.length && !dragSet.includes(target)) moveItemsTo(dragSet, target, dropMode(row, e));
  dragRow = null; dragSet = []; clearDrop();
});
$('#layer-list').addEventListener('dragend', () => { dragRow = null; dragSet = []; clearDrop(); });

/* ─────────────────────────── Champs de l'inspecteur ─────────────────────────── */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const reg = fn => { S.fields.push(fn); fn(); };
function refreshFields() { for (const f of S.fields) try { f(); } catch (e) {} }
const sec = (title, ic, ...kids) => h('div', { class: 'sec' }, h('div', { class: 'sec-t', html: (ic ? icon(ic) : '') + esc(title) }), ...kids);
const row = (label, ...ctrl) => h('div', { class: 'row' }, h('label', {}, label), h('div', { class: 'grow', style: 'display:flex;align-items:center;gap:6px;min-width:0' }, ...ctrl));
const note = html => h('div', { class: 'sec-note', html });

/* Nombre avec « scrub » : glisser le libellé change la valeur (comme Photoshop) */
function num(prefix, get, set, o = {}) {
  const inp = h('input', { type: 'text', inputmode: 'decimal', spellcheck: 'false' });
  const lab = h('span', { title: 'Glisse pour ajuster' }, prefix);
  const wrap = h('div', { class: 'num' }, lab, inp, o.unit ? h('em', {}, o.unit) : null);
  const fmt = v => (v == null || v === '' ? '' : String(round(v, o.dec ?? 1)));
  reg(() => { if (document.activeElement !== inp) inp.value = fmt(get()); });
  const apply = (v, commitMode) => {
    if (o.min != null) v = Math.max(o.min, v);
    if (o.max != null) v = Math.min(o.max, v);
    set(v); changed(o.level || 'css', { commit: commitMode, vars: o.vars });
  };
  inp.addEventListener('change', () => { const v = parseFloat(String(inp.value).replace(',', '.')); if (!isNaN(v)) apply(v, 'now'); else inp.value = fmt(get()); });
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const st = (o.step || 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      apply((+get() || 0) + st, 300); inp.value = fmt(get());
    }
  });
  lab.addEventListener('pointerdown', e => {
    e.preventDefault();
    const x0 = e.clientX, v0 = +get() || 0;
    lab.setPointerCapture(e.pointerId);
    const mv = ev => { apply(v0 + (ev.clientX - x0) * (o.step || 1) * (ev.shiftKey ? 10 : 1) * (o.scrub || 1), false); inp.value = fmt(get()); };
    const up = () => { lab.removeEventListener('pointermove', mv); lab.removeEventListener('pointerup', up); commit(); };
    lab.addEventListener('pointermove', mv); lab.addEventListener('pointerup', up);
  });
  return wrap;
}
function slider(get, set, o = {}) {
  const r = h('input', { type: 'range', min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 1 });
  const v = h('span', { class: 'val' });
  const show = () => { const x = get(); r.value = x; v.textContent = (o.fmt ? o.fmt(x) : round(x, o.dec ?? 0)) + (o.unit || ''); };
  reg(show);
  r.addEventListener('input', () => { set(+r.value); show(); changed(o.level || 'css', { commit: 500, vars: o.vars }); });
  return h('div', { class: 'slider grow' }, r, v);
}
function parseColor(s) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/i))) {
    let x = m[1];
    if (x.length <= 4) x = x.split('').map(c => c + c).join('');
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: x.length === 8 ? round(parseInt(x.slice(6, 8), 16) / 255, 3) : 1 };
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i))) {
    let a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}
const hex2 = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
const toHex = c => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b);
const toCss = c => c.a >= 1 ? toHex(c) : `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${round(c.a, 3)})`;
function colorField(get, set, o = {}) {
  const pick = h('input', { type: 'color' });
  const fill = h('i');
  const sw = h('div', { class: 'swatch' }, fill, pick);
  const txt = h('input', { class: 'hex', spellcheck: 'false' });
  const alpha = o.alpha !== false ? num('A', () => { const c = parseColor(get()); return c ? Math.round(c.a * 100) : 100; }, v => {
    const c = parseColor(get()) || { r: 255, g: 255, b: 255, a: 1 };
    c.a = clamp(v, 0, 100) / 100; set(toCss(c));
  }, { min: 0, max: 100, unit: '%', dec: 0, level: o.level, vars: o.vars }) : null;
  if (alpha) alpha.classList.add('alpha');
  const resetBtn = o.reset ? h('button', { class: 'reset', title: 'Valeur du thème de base', html: icon('replay'), onclick: () => { o.reset(); changed(o.level || 'css', { commit: 'now', vars: o.vars }); refreshFields(); } }) : null;
  reg(() => {
    const v = get(), c = parseColor(v);
    fill.style.background = v || 'transparent';
    if (c) pick.value = toHex(c);
    if (document.activeElement !== txt) txt.value = v || '';
    if (resetBtn) resetBtn.classList.toggle('hidden', !(o.isSet && o.isSet()));
  });
  pick.addEventListener('input', () => {
    const c = parseColor(pick.value), old = parseColor(get());
    if (old) c.a = old.a;
    set(toCss(c)); refreshFields(); changed(o.level || 'css', { commit: 500, vars: o.vars });
  });
  txt.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') txt.blur(); });
  txt.addEventListener('change', () => { const c = parseColor(txt.value); if (c || /^(var|linear|transparent)/.test(txt.value)) { set(c ? toCss(c) : txt.value.trim()); changed(o.level || 'css', { commit: 'now', vars: o.vars }); } refreshFields(); });
  return h('div', { class: 'color' }, sw, txt, alpha, resetBtn);
}
function selectField(opts, get, set, o = {}) {
  const s = h('select', { class: 'in' });
  const add = (parent, [v, l]) => parent.append(h('option', { value: v }, l));
  for (const op of opts) {
    if (op && op.group) { const g = h('optgroup', { label: op.group }); op.items.forEach(x => add(g, x)); if (op.items.length) s.append(g); }
    else add(s, op);
  }
  reg(() => { const v = get(); if (document.activeElement !== s) s.value = v == null ? '' : v; });
  s.addEventListener('change', () => { const r = set(s.value); if (r !== false) changed(o.level || 'css', { commit: 'now', inspector: o.rebuild, layers: o.layers, vars: o.vars }); });
  s.addEventListener('keydown', e => e.stopPropagation());
  return s;
}
function toggle(get, set, o = {}) {
  const inp = h('input', { type: 'checkbox' });
  reg(() => { inp.checked = !!get(); });
  inp.addEventListener('change', () => { set(inp.checked); changed(o.level || 'css', { commit: 'now', inspector: o.rebuild, layers: o.layers }); });
  return h('label', { class: 'toggle' }, inp, h('span'));
}
function textInput(get, set, o = {}) {
  const t = h(o.area ? 'textarea' : 'input', { class: 'in' + (o.code ? ' code' : ''), spellcheck: 'false', type: o.area ? null : 'text', placeholder: o.placeholder || '', id: o.id || null, maxlength: o.max || null, rows: o.rows || null });
  reg(() => { if (document.activeElement !== t) t.value = get() ?? ''; });
  t.addEventListener('input', () => { set(t.value); changed(o.level || 'css', { commit: 600, layers: o.layers }); });
  t.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Tab' && o.code) { e.preventDefault(); const p = t.selectionStart; t.value = t.value.slice(0, p) + '  ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = p + 2; t.dispatchEvent(new Event('input')); } });
  return t;
}
const btn = (label, ic, fn, cls = '') => h('button', { class: 'btn ' + cls, html: (ic ? icon(ic) : '') + esc(label), onclick: fn });
function fileRow(label, getId, setId, accept, o = {}) {
  const name = h('div', { class: 'fname' });
  reg(() => { const id = getId(); const a = id && S.p.assets[id]; name.textContent = a ? a.name : (o.empty || 'Aucun fichier'); name.classList.toggle('set', !!a); });
  const choose = btn(getId() ? 'Remplacer' : 'Choisir', 'upload', async () => {
    const f = await pickFile(accept);
    if (!f) return;
    busy(true, 'Import du fichier…');
    try { const id = await uploadBlob(f, f.name); setId(id); if (o.after) await o.after(f); changed(o.level || 'layers', { commit: 'now', inspector: true, layers: true }); }
    catch (e) { toast(e.message, 'err'); }
    busy(false);
  });
  const rm = o.removable ? btn('', 'x', () => { setId(null); changed(o.level || 'layers', { commit: 'now', inspector: true }); }) : null;
  if (rm) rm.title = 'Retirer';
  return h('div', {}, label ? h('div', { class: 'lbl', style: 'width:auto;margin-bottom:5px' }, label) : null, h('div', { class: 'file-row' }, name, choose, rm));
}
function fontOptions(withDefault) {
  const imported = S.p.fonts.map(f => [f.family, f.family + ' (importée)']);
  return [
    ...(withDefault ? [['', withDefault]] : []),
    { group: 'Polices', items: FONTS.map(f => [f.name, f.name]) },
    { group: 'Importées', items: imported },
    { group: '—', items: [['__import', '＋ Importer une police (.ttf, .otf, .woff)…']] },
  ];
}
async function fontSetter(v, apply) {
  if (v === '__import') { const fam = await importFont(); if (fam) apply(fam); renderInspector(); return false; }
  apply(v || null);
}
/* boutons à cocher (plusieurs possibles) */
function chipToggles(defs, isOn, onClick) {
  const wrap = h('div', { class: 'chips toggles' });
  for (const [k, l] of defs) {
    const b = h('button', { class: 'chip', onclick: () => { onClick(k); refreshFields(); } }, l);
    reg(() => b.classList.toggle('on', !!isOn(k)));
    wrap.append(b);
  }
  return wrap;
}
function iconRow(defs, isOn, onClick) {
  const r = h('div', { class: 'icon-row' });
  for (const [k, ic, title] of defs) {
    const b = h('button', { title, html: icon(ic), onclick: () => { onClick(k); refreshFields(); } });
    reg(() => b.classList.toggle('on', !!(isOn && isOn(k))));
    r.append(b);
  }
  return r;
}

/* ─────────────────────────── Inspecteur ─────────────────────────── */
const insp = $('#inspector');
function setTab(t) { S.tab = t; renderInspector(); }
function renderInspector() {
  S.fields = [];
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  const scroll = insp.scrollTop;
  insp.innerHTML = '';
  if (S.tab === 'theme') renderThemeTab();
  else if (!S.sel) insp.append(h('div', { class: 'empty-insp', html: `${icon('pointer')}<b>Aucune sélection</b>Clique un élément de l'overlay ou un calque pour le modifier.<br><br>Couleurs, polices et transitions : onglet <b>Thème</b>.` }));
  else if (isMulti()) renderMultiProps();
  else if (S.sel.kind === 'group') renderGroupProps();
  else if (S.tab === 'props') S.sel.kind === 'el' ? renderElProps() : renderLayerProps();
  else S.sel.kind === 'el' ? renderElAnim() : renderLayerAnim();
  hydrateIcons(insp);
  insp.scrollTop = scroll;
}
function inspTitle(ic, name, sub) {
  return h('div', { class: 'insp-title', html: `<div class="l-ico">${typeof ic === 'string' && ic.startsWith('<') ? ic : icon(ic)}</div><div><b>${esc(name)}</b><span>${esc(sub)}</span></div>` });
}
const ALIGN_DEFS = [['l', 'aL', 'Aligner à gauche'], ['c', 'aC', 'Centrer horizontalement'], ['r', 'aR', 'Aligner à droite'], ['t', 'aT', 'Aligner en haut'], ['m', 'aM', 'Centrer verticalement'], ['b', 'aB', 'Aligner en bas']];

/* Dossier : nom, visibilité, verrou, opacité, position du groupe (même onglet pour Calque et Animation) */
function renderGroupProps() {
  const g = groupById(S.sel.id);
  if (!g) return;
  const ms = membersOf(g.id);
  insp.append(inspTitle('folderOpen', g.name || 'Dossier', `Dossier · ${ms.length} calque${ms.length > 1 ? 's' : ''}`));
  insp.append(sec('Dossier', 'folder',
    row('Nom', textInput(() => g.name, v => { g.name = v; }, { max: 40, layers: true })),
    row('Visible', toggle(() => !g.hidden, v => { if (v) delete g.hidden; else g.hidden = true; }, { level: 'layers', layers: true })),
    row('Verrouillé', toggle(() => !!g.locked, v => { if (v) g.locked = true; else delete g.locked; }, { layers: true })),
    row('Opacité', slider(() => g.o ?? 100, v => { g.o = v; }, { unit: ' %' })),
    note('Glisse des calques sur le dossier pour les y ranger (moitié basse de la ligne). Sur le canevas, un dossier <b>replié</b> se sélectionne et se déplace d\'un bloc ; déplié, on clique ses calques un par un.')));
  /* moments du dossier : filtre appliqué à tout son contenu */
  insp.append(sec('Affichage', 'eye',
    h('div', { class: 'lbl', style: 'width:auto;margin-bottom:6px' }, 'Afficher pendant'),
    chipToggles(MOMENTS, k => (groupShow(g) || ['always']).includes(k), k => {
      let s = (groupShow(g) || []).slice();
      if (k === 'always') s = [];
      else if (s.includes(k)) s = s.filter(x => x !== k);
      else s.push(k);
      if (s.length) g.show = MOMENTS.map(m => m[0]).filter(m => s.includes(m)); else delete g.show;
      changed('layers', { commit: 'now', layers: true });
      const gs = groupShow(g), f = F();
      if (gs && f && !f.isShown(gs)) { const sc = SHOW_SCENE[gs[0]]; if (sc) setScene(sc, true); }
    }),
    note('Tout le contenu du dossier n\'apparaît qu\'à ces moments, en plus des réglages de chaque calque. Par exemple, décoche <b>Replay</b> pour cacher tout le dossier pendant les replays. <b>Toujours</b> = aucune restriction.')));
  if (ms.length) {
    const sel = { kind: 'group', id: g.id };
    insp.append(sec('Position du groupe', 'pointer',
      h('div', { class: 'grid2' },
        num('X', () => getPos(sel).x, v => setPos(sel, v, getPos(sel).y)),
        num('Y', () => getPos(sel).y, v => setPos(sel, getPos(sel).x, v))),
      iconRow(ALIGN_DEFS, null, alignSel),
      note('Les poignées d\'angle agrandissent tout le dossier (positions, tailles et textes).')));
  }
  insp.append(h('div', { class: 'sec' }, h('div', { class: 'btns' },
    ms.length ? btn('Rejouer les animations', 'play', () => ms.forEach(L => replayLayer(L.id)), 'primary') : null,
    btn('Dissocier', 'folderOpen', () => ungroup(g.id)),
    btn('Dupliquer', 'copy', () => duplicateLayer(g.id)),
    btn('Supprimer', 'trash', deleteSelection, 'danger'))));
}

/* Sélection multiple : position du bloc, alignements, répartition et actions groupées */
function renderMultiProps() {
  const list = selList(), n = list.length;
  const names = list.map(itemName);
  insp.append(inspTitle('layers', `${n} éléments sélectionnés`, names.slice(0, 3).join(', ') + (n > 3 ? ` +${n - 3}` : '')));
  const mb = () => multiBox() || { cx: 0, cy: 0, w: 0, h: 0 };
  const moveAll = (dx, dy) => moveList().filter(s => !isLocked(s)).forEach(s => { const p = getPos(s); setPos(s, p.x + dx, p.y + dy); });
  insp.append(sec('Position', 'pointer',
    h('div', { class: 'grid2' },
      num('X', () => round(mb().cx - mb().w / 2), v => moveAll(v - (mb().cx - mb().w / 2), 0)),
      num('Y', () => round(mb().cy - mb().h / 2), v => moveAll(0, v - (mb().cy - mb().h / 2)))),
    row('Aligner sur', selectField([['sel', 'La sélection'], ['canvas', 'L\'écran']], () => S.alignTo || 'sel', v => { S.alignTo = v; return false; })),
    iconRow(ALIGN_DEFS, null, alignMulti),
    n >= 3 ? h('div', { class: 'btns' }, btn('Répartir horizontalement', 'distH', () => distribute('h')), btn('Répartir verticalement', 'distV', () => distribute('v')))
      : note('Sélectionne au moins 3 éléments pour les répartir à espaces égaux.')));
  const hasLayers = list.some(s => s.kind !== 'el');
  insp.append(sec('Actions', 'sliders',
    h('div', { class: 'btns' },
      hasLayers ? btn('Grouper dans un dossier', 'folderPlus', groupSelection) : null,
      hasLayers ? btn('Dupliquer', 'copy', duplicateSelected) : null,
      btn('Masquer', 'eyeoff', () => setFlag('hidden', true)), btn('Afficher', 'eye', () => setFlag('hidden', false)),
      btn('Verrouiller', 'lock', () => setFlag('locked', true)), btn('Déverrouiller', 'unlock', () => setFlag('locked', false)),
      btn('Supprimer', 'trash', deleteSelection, 'danger')),
    note('<b>Maj</b> ou <b>Ctrl</b> + clic : ajouter / retirer · glisser dans le vide : rectangle de sélection · <b>Ctrl+A</b> : tous les calques · flèches : déplacer. Les éléments de l\'overlay sont masqués au lieu d\'être supprimés.')));
}

/* Sidebars : valeur affichée = réglage du projet, sinon valeur mesurée dans l'aperçu */
function sbMeasure(side) {
  try {
    const doc = FD(), w = frame.contentWindow, sb = doc.getElementById('sidebar-' + side);
    const row = sb.querySelector('.player-row:not(.spectating)') || sb.querySelector('.player-row');
    const q = s => sb.querySelector(s), cs = el => el ? w.getComputedStyle(el) : null;
    return {
      width: sb.offsetWidth, gap: parseFloat(cs(sb).rowGap) || 0,
      rowH: (q('.pr-info') || {}).offsetHeight, radius: parseFloat((cs(row) || {}).borderTopLeftRadius) || 0,
      rowBg: (cs(row) || {}).backgroundColor, accentW: (q('.pr-accent') || {}).offsetWidth,
      nameSize: parseFloat((cs(q('.pr-name')) || {}).fontSize), nameColor: (cs(row && row.querySelector('.pr-name')) || {}).color,
      valSize: parseFloat((cs(q('.pr-val')) || {}).fontSize), valColor: (cs(row && row.querySelector('.pr-val')) || {}).color,
      boostH: (q('.pr-boost-bar') || {}).offsetHeight, notifSize: (q('.pr-info') || {}).offsetHeight,
    };
  } catch (e) { return {}; }
}
function sidebarSections(side) {
  const other = side === 'blue' ? 'orange' : 'blue';
  const m = sbMeasure(side);
  const conf = () => S.p.sidebar[side] || {};
  const G = (k, d) => conf()[k] ?? m[k] ?? d;
  const set = k => v => {
    for (const s of S.p.sidebar.link !== false ? [side, other] : [side]) {
      S.p.sidebar[s] ||= {};
      if (v === null || v === undefined || v === '') delete S.p.sidebar[s][k]; else S.p.sidebar[s][k] = v;
    }
  };
  const sl = (k, label, min, max, def, unit = ' px', step = 1) => row(label, slider(() => G(k, def), set(k), { min, max, step, unit }));
  const col = (k, label, def) => row(label, colorField(() => G(k, def), set(k), { reset: () => set(k)(null), isSet: () => conf()[k] != null }));
  const testNotif = () => { try { const w = frame.contentWindow; w.showStatIcon(side === 'blue' ? 'p1' : 'p5', side === 'blue' ? 'Ayyjayy' : 'Joyo', 'goal'); } catch (e) {} };
  const out = [];
  out.push(sec('Sidebars', 'list',
    row('Lier bleu et orange', toggle(() => S.p.sidebar.link !== false, v => { S.p.sidebar.link = v; if (v) S.p.sidebar[other] = clone(S.p.sidebar[side] || {}); }, { rebuild: true })),
    note(S.p.sidebar.link !== false ? 'Les réglages s\'appliquent aux <b>deux</b> sidebars.' : `Réglages de la sidebar <b>${side === 'blue' ? 'bleue' : 'orange'}</b> uniquement.`),
    h('div', { class: 'btns' }, btn('Réinitialiser', 'replay', () => { S.p.sidebar[side] = {}; if (S.p.sidebar.link !== false) S.p.sidebar[other] = {}; changed('css', { commit: 'now', inspector: true }); }))));
  out.push(sec('Lignes joueurs', 'list',
    sl('width', 'Largeur', 120, 480, 210), sl('rowH', 'Hauteur', 20, 90, 40), sl('gap', 'Espacement', 0, 40, 3), sl('radius', 'Arrondi', 0, 40, 6),
    col('rowBg', 'Fond', 'rgba(8,8,20,0.88)'), col('specBg', 'Joueur suivi', '#ffffff'),
    sl('accentW', 'Bande d\'équipe', 0, 30, 5), col('accentColor', 'Couleur bande', side === 'blue' ? '#1a5fff' : '#d96000')));
  out.push(sec('Textes', 'text',
    sl('nameSize', 'Taille du nom', 8, 40, 16), col('nameColor', 'Couleur du nom', '#ffffff'),
    sl('valSize', 'Taille du boost', 8, 48, 22), col('valColor', 'Couleur du boost', '#ffd700')));
  const fillMode = G('boost', 'bottom') === 'fill';
  out.push(sec('Barre de boost', 'bar',
    row('Position', selectField([['bottom', 'Sous le nom'], ['top', 'Au-dessus du nom'], ['fill', 'Remplit la ligne (derrière le nom)'], ['hide', 'Masquée']], () => G('boost', 'bottom'), v => { set('boost')(v); }, { rebuild: true })),
    fillMode ? row('Opacité', slider(() => Math.round((G('boostAlpha', .6)) * 100), v => set('boostAlpha')(v / 100), { min: 10, max: 100, unit: ' %' })) : sl('boostH', 'Épaisseur', 1, 30, 6),
    fillMode ? note('La ligne du joueur se remplit avec son boost, derrière son nom (côté orange : depuis la droite).') : null,
    col('boostC1', 'Couleur début', side === 'blue' ? '#1a5fff' : '#d96000'),
    col('boostC2', 'Couleur fin', side === 'blue' ? '#60a0ff' : '#ff9c33'), col('boostBg', 'Fond de la barre', 'rgba(255,255,255,0.07)')));
  out.push(sec('Notifications', 'zap',
    note('Icônes d\'événement (but, arrêt, démo…) qui apparaissent à côté de la ligne du joueur pendant 5 s.'),
    row('Animation', selectField(NOTIF_ANIMS, () => G('notifAnim', 'default'), v => { set('notifAnim')(v === 'default' ? null : v); setTimeout(testNotif, 60); })),
    row('Courbe', selectField(EASE_OPTS, () => G('notifEase', 'smooth'), set('notifEase'))),
    sl('notifSize', 'Taille', 16, 100, 40), sl('notifGap', 'Écart', -40, 120, 0), sl('notifY', 'Décalage vertical', -60, 60, 0),
    col('notifBg', 'Fond', side === 'blue' ? '#1a5fff' : '#d96000'), sl('notifRadius', 'Arrondi', 0, 50, 4),
    h('div', { class: 'btns' }, btn('Voir une notification', 'play', testNotif, 'primary'))));
  return out;
}
/* Annonce de but : texte, buteur, durée, animations, style, ou masquée pour faire la sienne avec des calques */
function goalSections(d) {
  const g = () => d.goal || {};
  const upd = (k, v) => { const x = { ...g() }; if (v === null || v === undefined || v === '') delete x[k]; else x[k] = v; if (Object.keys(x).length) d.goal = x; else delete d.goal; };
  const col = (k, label) => row(label, colorField(() => g()[k] || '', v => upd(k, v), { reset: () => upd(k, null), isSet: () => !!g()[k] }));
  const prefixMode = () => g().prefix == null ? 'ball' : g().prefix === '' ? 'none' : 'but';
  return [
    sec('Annonce de but', 'zap',
      note('Le gros « GOAL! » affiché à chaque but.'),
      h('div', { class: 'btns', style: 'margin-bottom:10px' }, btn('Tester un but', 'play', () => playTest('goal'), 'primary')),
      row('Texte', textInput(() => g().text || '', v => upd('text', v.slice(0, 30)), { placeholder: 'GOAL!', level: 'all' })),
      row('Buteur', toggle(() => g().scorer !== false, v => upd('scorer', v ? null : false), { level: 'all' })),
      row('Présentation', selectField([['ball', '⚽ Nom'], ['none', 'Nom seul'], ['but', 'BUT DE Nom']], prefixMode, v => upd('prefix', v === 'ball' ? null : v === 'none' ? '' : 'BUT DE '), { level: 'all' })),
      row('Durée', slider(() => g().dur ?? 4, v => upd('dur', v === 4 ? null : v), { min: 1, max: 12, step: .5, dec: 1, unit: ' s', level: 'all' })),
      row('Masquer l\'annonce', toggle(() => !!d.hidden, v => { if (v) d.hidden = true; else delete d.hidden; }, { layers: true })),
      note('Masquée, le moment <b>But</b> reste actif : ajoute tes calques (vidéo, Lottie, texte, logo de l\'équipe qui marque…) avec <b>Afficher pendant : But</b> pour faire ta propre animation.')),
    sec('Animation du but', 'play',
      row('Entrée', selectField([['none', 'Celle du thème'], ...IN_ANIMS.filter(a => a[0] !== 'none')], () => g().inAnim || 'none', v => { upd('inAnim', v === 'none' ? null : v); setTimeout(() => setScene('goal', true), 30); })),
      h('div', { class: 'grid2' },
        num('Durée', () => g().inDur ?? .6, v => upd('inDur', clamp(v, .1, 5)), { unit: 's', step: .05, dec: 2, scrub: .2 }),
        selectField(EASE_OPTS, () => g().inEase || 'back', v => upd('inEase', v))),
      row('Mot en boucle', selectField([['none', 'Aucune'], ['pulse', 'Pulsation'], ['heartbeat', 'Battement'], ['shake', 'Tremblement'], ['glow', 'Lueur'], ['float', 'Flottement'], ['swing', 'Balancement'], ['blink', 'Clignotement'], ['wobble', 'Ondulation']],
        () => g().wordLoop || 'none', v => upd('wordLoop', v === 'none' ? null : v))),
      num('Durée boucle', () => g().loopDur ?? 1.2, v => upd('loopDur', clamp(v, .2, 10)), { unit: 's', step: .1, dec: 1, scrub: .2 }),
      row('Reflet animé', toggle(() => !g().noShine, v => upd('noShine', v ? null : true)))),
    sec('Fond de l\'annonce', 'palette',
      col('bg', 'Fond'),
      row('Arrondi', slider(() => g().radius ?? 0, v => upd('radius', v), { max: 80, unit: ' px' })),
      row('Bordure', slider(() => g().borderW || 0, v => upd('borderW', v || null), { max: 12, unit: ' px' })),
      row('Couleur bordure', colorField(() => g().borderC || '#ffffff', v => upd('borderC', v))),
      h('div', { class: 'grid2' },
        num('↔', () => g().padX ?? 70, v => upd('padX', clamp(Math.round(v), 0, 400)), { unit: 'px', dec: 0 }),
        num('↕', () => g().padY ?? 20, v => upd('padY', clamp(Math.round(v), 0, 300)), { unit: 'px', dec: 0 }))),
    sec('Texte de l\'annonce', 'text',
      row('Police', selectField(fontOptions('Police du thème'), () => g().font || '', v => fontSetter(v, f => { upd('font', f || null); changed('css', { commit: 'now' }); }))),
      row('Taille', slider(() => g().size ?? 80, v => upd('size', v), { min: 20, max: 260, unit: ' px' })),
      col('color', 'Couleur'),
      note('Couleur vide = celle du thème (souvent la couleur de l\'équipe qui marque).'),
      row('Espacement', slider(() => g().spacing ?? 0, v => upd('spacing', v), { min: -5, max: 40, unit: ' px' })),
      row('Italique', toggle(() => !!g().italic, v => upd('italic', v || null))),
      row('Contour', slider(() => g().stroke || 0, v => upd('stroke', v || null), { max: 12, step: .5, dec: 1, unit: ' px' })),
      row('Couleur contour', colorField(() => g().strokeC || '#000000', v => upd('strokeC', v))),
      row('Lueur', slider(() => g().glow || 0, v => upd('glow', v || null), { max: 60, unit: ' px' })),
      col('glowC', 'Couleur lueur'),
      row('Taille du buteur', slider(() => g().subSize ?? 22, v => upd('subSize', v), { min: 8, max: 80, unit: ' px' })),
      col('subColor', 'Couleur du buteur')),
  ];
}

/* Stat bar : valeur affichée = réglage, sinon valeur mesurée dans l'aperçu */
function statBarSections(d) {
  const m = () => d.stb || {};
  const upd = (k, v) => { const x = { ...m() }; if (v === null || v === undefined || v === '') delete x[k]; else x[k] = v; d.stb = x; };
  let meas = {};
  try {
    const doc = FD(), w = frame.contentWindow, bar = doc.getElementById('stat-bar'), cs = el => el ? w.getComputedStyle(el) : {};
    meas = { h: bar.offsetHeight, w: bar.offsetWidth, tagW: (doc.getElementById('stat-team-tag') || {}).offsetWidth,
      nameSize: parseFloat(cs(doc.getElementById('stat-player-name')).fontSize), valSize: parseFloat(cs(bar.querySelector('.stat-val')).fontSize),
      lblSize: parseFloat(cs(bar.querySelector('.stat-lbl')).fontSize), radius: parseFloat(cs(bar).borderTopRightRadius) || 0 };
  } catch (e) {}
  const G = (k, def) => m()[k] ?? meas[k] ?? def;
  const sl = (k, label, min, max, def) => row(label, slider(() => G(k, def), v => upd(k, v), { min, max, unit: ' px' }));
  const col = (k, label, def) => row(label, colorField(() => m()[k] || def, v => upd(k, v), { reset: () => upd(k, null), isSet: () => !!m()[k] }));
  const hidden = () => m().hide || [];
  return [
    sec('Stat bar', 'bar',
      sl('w', 'Largeur', 300, 1920, 860), sl('h', 'Hauteur', 30, 200, 76), sl('radius', 'Arrondi', 0, 60, 12),
      sl('tagW', 'Bloc du joueur', 80, 600, 220), col('tagBg', 'Fond du joueur', ''), col('valsBg', 'Fond des stats', ''),
      note('Fond du joueur vide = couleur de l\'équipe du joueur suivi.'),
      h('div', { class: 'btns' }, btn('Réinitialiser', 'replay', () => { delete d.stb; changed('css', { commit: 'now', inspector: true }); }))),
    sec('Textes de la stat bar', 'text',
      sl('nameSize', 'Taille du nom', 8, 70, 26), col('nameColor', 'Couleur du nom', '#ffffff'),
      sl('valSize', 'Taille des scores', 8, 80, 28), col('valColor', 'Couleur des scores', '#ffffff'),
      sl('lblSize', 'Taille des libellés', 6, 40, 11), col('lblColor', 'Couleur des libellés', 'rgba(255,255,255,0.32)'),
      row('Libellés', toggle(() => !m().hideLbl, v => upd('hideLbl', v ? null : true))),
      row('Flèches', toggle(() => !m().hideArrows, v => upd('hideArrows', v ? null : true))),
      row('Séparateurs', toggle(() => !m().noSep, v => upd('noSep', v ? null : true)))),
    sec('Stats affichées', 'list',
      ...STAT_KEYS.map(([k, l]) => row(l, toggle(() => !hidden().includes(k), v => upd('hide', v ? hidden().filter(x => x !== k) : [...hidden(), k])))),
      note('Pour placer un score où tu veux, ajoute un calque <b>Texte</b> avec <b>{goals}</b>, <b>{assists}</b>, <b>{shots}</b>, <b>{saves}</b> ou <b>{demos}</b> (joueur suivi).')),
  ];
}
/* Boost meter d'origine : réglages, ou remplacement par une jauge (calque) */
function boostMeterSection(d) {
  const m = () => d.bmt || {};
  const upd = (k, v) => { const x = { ...m() }; if (v === null || v === undefined || v === '') delete x[k]; else x[k] = v; d.bmt = x; };
  const col = (k, label, def) => row(label, colorField(() => m()[k] || def, v => upd(k, v), { reset: () => upd(k, null), isSet: () => !!m()[k] }));
  return sec('Boost meter', 'gauge',
    row('Forme', selectField([['circle', 'Rond'], ['square', 'Carré arrondi'], ['none', 'Sans fond']], () => m().shape || 'circle', v => upd('shape', v === 'circle' ? null : v))),
    col('bg', 'Fond', ''), col('ring', 'Anneau', ''), col('track', 'Piste', ''),
    row('Épaisseur', slider(() => m().width ?? 11, v => upd('width', v), { min: 2, max: 30 })),
    row('Jauge', selectField([['theme', 'Celle du thème'], ['full', 'Cercle complet'], ['arc', 'Arc (3/4, réglable)']], () => m().arc || 'theme', v => upd('arc', v === 'theme' ? null : v), { level: 'all', rebuild: true })),
    ...(m().arc ? arcControls(k => m()[k], (k, v) => upd(k, v), { full: m().arc === 'full', sweepLevel: 'all' })
      : [row('Bouts de la ligne', selectField(ARC_CAPS, () => m().cap || 'round', v => upd('cap', v === 'round' ? null : v)))]),
    row('Lueur', slider(() => m().glow || 0, v => upd('glow', v || null), { max: 30, unit: ' px' })),
    row('Taille du chiffre', slider(() => m().numSize ?? 52, v => upd('numSize', v), { min: 16, max: 120, unit: ' px' })),
    col('numColor', 'Couleur du chiffre', ''),
    row('Vitesse', toggle(() => m().speed !== false, v => upd('speed', v ? null : false))),
    row('Graduations', toggle(() => m().ticks !== false, v => upd('ticks', v ? null : false))),
    note('Couleurs vides = celles du thème (anneau à la couleur de l\'équipe). Pour un tout autre style (barre, segments, arc…), remplace-le par une jauge :'),
    h('div', { class: 'btns' }, btn('Remplacer par une jauge (calque)', 'gauge', () => addLayer('boost')), btn('Réinitialiser', 'replay', () => { delete d.bmt; changed('css', { commit: 'now', inspector: true }); })));
}

/* Réglages d'un objet du projet : valeur affichée = réglage, sinon valeur mesurée dans l'aperçu, sinon défaut.
   read() ne crée rien (lecture seule), ensure() crée l'objet au premier réglage. Vide = valeur du thème. */
function cfgKit(read, ensure, measure) {
  const set = (k, v) => { const x = ensure(); if (v === null || v === undefined || v === '') delete x[k]; else x[k] = v; };
  const G = (k, def) => { const v = read()[k]; if (v != null) return v; const m = measure ? measure()[k] : undefined; return m != null ? m : def; };
  return {
    set, G,
    sl: (k, label, min, max, def, o = {}) => row(label, slider(() => G(k, def), v => set(k, v), { min, max, unit: o.unit ?? ' px', step: o.step, dec: o.dec })),
    col: (k, label, def = '') => row(label, colorField(() => read()[k] || def, v => set(k, v), { reset: () => set(k, null), isSet: () => !!read()[k] })),
    /* inv : interrupteur « affiché » pour une clé « masqué » (noX / hideX) */
    tog: (k, label, inv) => row(label, toggle(() => (inv ? !read()[k] : !!read()[k]), v => set(k, (inv ? !v : v) || null))),
    txt: (k, label, ph, o = {}) => row(label, textInput(() => read()[k] ?? '', v => set(k, v.slice(0, o.max || 30) || null), { placeholder: ph, level: o.level || 'all' })),
  };
}
/* mesures dans l'aperçu (px) — clés absentes si l'élément n'est pas affiché */
function measureIn(rootSel, defs) {
  const out = {};
  try {
    const doc = FD(), w = frame.contentWindow;
    for (const [k, sel, prop] of defs) {
      const el = doc.querySelector(`${rootSel} ${sel}`);
      if (!el) continue;
      const v = prop === 'w' ? el.offsetWidth : prop === 'h' ? el.offsetHeight : parseFloat(w.getComputedStyle(el)[prop]);
      if (isFinite(v) && (v > 0 || prop !== 'w' && prop !== 'h')) out[k] = round(v, 1);
    }
  } catch (e) {}
  return out;
}
const baseVar = name => { try { return frame.contentWindow.getComputedStyle(FD().body).getPropertyValue(name).trim(); } catch (e) { return ''; } };
const varCol = (k, label) => row(label, colorField(() => S.p.vars[k] || baseVar(k), v => { S.p.vars[k] = v; }, { vars: true, reset: () => { delete S.p.vars[k]; }, isSet: () => S.p.vars[k] != null }));
/* Animation REPLAY / LIVE de base affichée ou masquée (réglage du projet, voir buildStudioCss) */
const wipeToggle = word => {
  const k = word === 'live' ? 'hideLive' : 'hideReplay';
  return row(word === 'live' ? 'Animation LIVE de base' : 'Animation REPLAY de base',
    toggle(() => !S.p.transitions[k], v => { if (v) delete S.p.transitions[k]; else S.p.transitions[k] = true; }, { rebuild: true }));
};
/* Équipe gagnante dans les scènes Fin de match / Victoire de l'aperçu (non enregistré) */
const winnerPick = () => row('Gagnant (aperçu)', selectField([['0', 'Équipe bleue'], ['1', 'Équipe orange']], () => String(S.pvWin || 0), v => { S.pvWin = +v; setScene(S.scene, true); setTimeout(renderSel, 120); return false; }));

/* Écran de fin : tout l'écran est réglable, les sections suivent l'élément sélectionné */
function endSections(E, d) {
  const read = () => S.p.end || {}, ensure = () => (S.p.end ||= {});
  const meas = measureIn('#end-screen', [
    ['hdrH', '#end-hdr', 'h'], ['sidePad', '.end-side', 'paddingLeft'], ['stripeW', '.end-side.blue', 'borderLeftWidth'],
    ['nameSize', '.end-side-name', 'fontSize'], ['nameSpacing', '.end-side-name', 'letterSpacing'], ['resSize', '.end-side-result', 'fontSize'],
    ['logoSize', '.end-logo-sq', 'w'], ['logoRadius', '.end-logo-sq', 'borderTopLeftRadius'], ['logoBorderW', '.end-logo-sq', 'borderTopWidth'],
    ['midW', '#end-mid', 'w'], ['boxSize', '.end-sc-box', 'w'], ['scoreSize', '.end-sc-box', 'fontSize'], ['boxRadius', '.end-sc-box', 'borderTopLeftRadius'],
    ['vsSize', '.end-vs-sep', 'fontSize'], ['serSize', '.end-ser-row', 'fontSize'],
    ['tblPad', '#end-table', 'paddingLeft'], ['topH', '.end-p-top', 'h'], ['rowH', '.end-p-cell', 'h'], ['lblW', '#end-lbl', 'w'],
    ['pSize', '.end-p-top', 'fontSize'], ['valSize', '.end-p-cell', 'fontSize'], ['lblSize', '.end-lbl-text', 'fontSize'],
    ['barH', '.end-bar-track', 'h'], ['barR', '.end-bar-track', 'borderTopLeftRadius'], ['bvSize', '.end-bv', 'fontSize'], ['blSize', '.end-bl-lbl', 'fontSize'],
    ['barsGap', '#end-bars', 'rowGap'], ['barsPad', '#end-bars', 'paddingLeft'], ['gap', '', 'rowGap']]);
  const K = cfgKit(read, ensure, () => meas);
  const out = [sec('Écran de fin', 'flag',
    note('Aperçu avec un <b>match fictif</b> (pseudos et stats inventés) pour voir tout ce qui se règle. En live, ce sont les vraies stats de la partie.'),
    winnerPick(),
    h('div', { class: 'btns', style: 'margin-bottom:10px' }, btn('Tester l\'écran de fin', 'play', () => playTest('end'), 'primary')),
    varCol('--end-bg', 'Fond'),
    fileRow('Fond (image ou vidéo)', () => S.p.endBg, id => { S.p.endBg = id; }, '.png,.jpg,.jpeg,.webp,.gif,.webm,.mp4', { removable: true, level: 'all', empty: 'Fond du thème' }),
    row('Position', selectField([['center', 'Centré'], ['flex-start', 'En haut'], ['flex-end', 'En bas']], () => read().align || 'center', v => K.set('align', v === 'center' ? null : v))),
    K.sl('gap', 'Écart entre les blocs', 0, 200, 0),
    note('Chaque bloc (en-tête, score, tableau, barres, logos) se sélectionne sur le canevas pour le déplacer, le redimensionner ou le masquer. Pour un écran 100 % perso, ajoute des calques avec <b>Afficher pendant : Fin de match</b> et les textes <b>{winner}</b>, <b>{mvp}</b>, <b>{mvp_score}</b>…'))];

  if (E.key === 'end-hdr') {
    out.push(sec('En-tête', 'flag',
      K.sl('hdrH', 'Hauteur', 40, 300, 96), K.col('sideBg', 'Fond des équipes', 'rgba(0,0,0,0.25)'), K.sl('sidePad', 'Marge intérieure', 0, 300, 36),
      K.sl('stripeW', 'Bande d\'équipe', 0, 40, 5), K.col('stripeB', 'Bande bleue'), K.col('stripeO', 'Bande orange'),
      K.tog('noWinGlow', 'Flash du gagnant', true),
      note('Bandes vides = couleur de chaque équipe.')));
    out.push(sec('Textes de l\'en-tête', 'text',
      K.txt('winText', 'Texte victoire', 'VICTORY !', { max: 30 }), K.txt('loseText', 'Texte défaite', 'DEFEAT', { max: 30 }),
      K.tog('hideRes', 'Victoire / défaite', true),
      K.sl('resSize', 'Taille', 6, 60, 10), K.col('resWinColor', 'Couleur victoire'), K.col('resColor', 'Couleur défaite', 'rgba(255,255,255,0.35)'),
      K.sl('nameSize', 'Taille des équipes', 10, 140, 32), K.col('nameColor', 'Couleur des équipes', '#ffffff'),
      K.sl('nameSpacing', 'Espacement', -5, 30, 2), K.tog('nameItalic', 'Italique'),
      note('Couleur victoire vide = couleur claire de l\'équipe gagnante.')));
  }
  if (E.key === 'end-logo-sq-blue' || E.key === 'end-logo-sq-orange') {
    out.push(sec('Logos (les deux)', 'shield',
      K.sl('logoSize', 'Taille', 20, 300, 60), K.sl('logoRadius', 'Arrondi', 0, 150, 10), K.col('logoBg', 'Fond', 'rgba(14,14,30,0.95)'),
      K.sl('logoBorderW', 'Bordure', 0, 16, 2), K.col('logoBorderC', 'Couleur bordure'),
      note('Bordure vide = couleur de chaque équipe. Arrondi au maximum = logo rond. Les logos viennent du panneau de contrôle (carte Équipes).')));
  }
  if (E.key === 'end-mid') {
    out.push(sec('Score central', 'board',
      K.sl('midW', 'Largeur', 80, 800, 240), varCol('--end-mid-bg', 'Fond'),
      K.sl('boxSize', 'Taille des cases', 24, 240, 64), K.sl('scoreSize', 'Taille des chiffres', 10, 200, 42), K.sl('boxRadius', 'Arrondi', 0, 120, 8),
      K.col('boxB', 'Case bleue'), K.col('boxO', 'Case orange'), K.col('scoreColor', 'Chiffres', '#ffffff'),
      K.txt('vs', 'Texte entre les scores', 'vs', { max: 30 }), K.sl('vsSize', 'Taille', 6, 80, 12), K.col('vsColor', 'Couleur', 'rgba(255,255,255,0.22)'),
      K.tog('hideSeries', 'Score de la série (BO)', true), K.sl('serSize', 'Taille de la série', 8, 80, 17), K.col('serColor', 'Couleur de la série', 'rgba(255,255,255,0.42)'),
      note('Cases vides = couleur de chaque équipe.')));
  }
  if (E.key === 'end-table') {
    out.push(sec('Tableau des stats', 'list',
      varCol('--end-tbl-bg', 'Fond'), K.sl('tblPad', 'Marge sur les côtés', 0, 400, 36),
      K.sl('topH', 'Hauteur des pseudos', 20, 140, 46), K.sl('rowH', 'Hauteur des lignes', 16, 160, 62), K.sl('lblW', 'Colonne des libellés', 60, 600, 200),
      K.col('headB', 'Pseudos bleus (fond)', 'rgba(26,95,255,0.12)'), K.col('headO', 'Pseudos orange (fond)', 'rgba(217,96,0,0.12)'), K.col('lblBg', 'Fond des libellés', 'rgba(0,0,0,0.2)'),
      K.tog('noSep', 'Lignes de séparation', true)));
    out.push(sec('Textes du tableau', 'text',
      K.sl('pSize', 'Taille des pseudos', 6, 60, 13), K.col('pColor', 'Couleur des pseudos', 'rgba(255,255,255,0.88)'),
      K.sl('valSize', 'Taille des stats', 8, 100, 28), K.col('valB', 'Stats bleues'), K.col('valO', 'Stats orange'),
      K.sl('lblSize', 'Taille des libellés', 6, 40, 10), K.col('lblColor', 'Couleur des libellés', 'rgba(255,255,255,0.3)'),
      K.tog('noMini', 'Mini-barres sous les libellés', true),
      note('Stats vides = couleur claire de chaque équipe.')));
    const hid = () => read().hide || [];
    const labels = () => read().labels || {};
    const setLabel = (k, v) => { const L = { ...labels() }; if (v.trim()) L[k] = v.slice(0, 16); else delete L[k]; if (Object.keys(L).length) ensure().labels = L; else delete ensure().labels; };
    out.push(sec('Stats affichées', 'list',
      ...END_STATS.map(([k, l, def]) => row(l,
        toggle(() => !hid().includes(k), v => { const s = hid().filter(x => x !== k); if (!v) s.push(k); K.set('hide', s.length ? s : null); }),
        textInput(() => labels()[k] || '', v => setLabel(k, v), { placeholder: def, level: 'all', max: 16 }))),
      note('Décoche une stat pour retirer sa ligne. Le champ renomme son libellé (ex. <b>BUTS</b> au lieu de GOALS), aussi dans les barres du bas.')));
    out.push(...mvpSections());
  }
  if (E.key === 'end-bars') {
    const bh = () => read().barsHide || [];
    out.push(sec('Barres de comparaison', 'bar',
      ...END_BARS.map(([k, l]) => row(l, toggle(() => !bh().includes(k), v => { const s = bh().filter(x => x !== k); if (!v) s.push(k); K.set('barsHide', s.length ? s : null); }))),
      K.sl('barH', 'Épaisseur', 2, 60, 8), K.sl('barR', 'Arrondi', 0, 30, 4), K.sl('barGap', 'Écart bleu / orange', 0, 30, 0),
      K.col('barB', 'Barre bleue'), K.col('barO', 'Barre orange'), K.col('trackBg', 'Fond des barres', 'rgba(255,255,255,0.05)'),
      K.sl('bvSize', 'Taille des chiffres', 8, 100, 20), K.col('bvB', 'Chiffres bleus'), K.col('bvO', 'Chiffres orange'),
      K.sl('blSize', 'Taille des libellés', 6, 40, 10), K.col('blColor', 'Couleur des libellés', 'rgba(255,255,255,0.32)'),
      K.col('barsBg', 'Fond de la zone', 'rgba(0,0,0,0.18)'), K.sl('barsGap', 'Espacement', 0, 80, 14), K.sl('barsPad', 'Marge sur les côtés', 0, 600, 60),
      note('Barres vides = dégradés du thème. Les libellés se renomment dans <b>Stats affichées</b> (sélectionne le tableau).')));
  }
  if (E.key === 'end-media-banner') out.push(mediaSections(() => d.mb, x => { d.mb = x; }, { size: { w: 560, h: 100 } }));
  return out;
}
/* MVP de l'écran de fin : qui, badge (texte / image), position, animation, mise en valeur de sa colonne */
function mvpSections() {
  const read = () => (S.p.end && S.p.end.mvp) || {}, ensure = () => ((S.p.end ||= {}).mvp ||= {});
  const K = cfgKit(read, ensure);
  const mode = read().mode || 'winner', st = read().style || 'text';
  const kids = [
    row('MVP', selectField([['winner', 'Meilleur score des gagnants'], ['match', 'Meilleur score du match'], ['off', 'Aucun MVP']], () => mode, v => K.set('mode', v === 'winner' ? null : v), { level: 'all', rebuild: true })),
  ];
  if (mode !== 'off') {
    kids.push(row('Badge', selectField([['text', 'Texte'], ['image', 'Image'], ['none', 'Aucun (colonne mise en valeur)']], () => st, v => K.set('style', v === 'text' ? null : v), { rebuild: true })));
    if (st === 'image') kids.push(
      fileRow('Image du badge', () => read().img, id => K.set('img', id), ACCEPT.image, { removable: true, level: 'css', empty: 'Choisis une image (PNG transparent conseillé)' }),
      K.sl('imgSize', 'Taille', 8, 240, 28));
    if (st === 'text') kids.push(
      K.txt('text', 'Texte', 'MVP', { max: 16, level: 'css' }), K.sl('size', 'Taille', 6, 60, 8),
      K.col('bg', 'Fond', '#ffd700'), K.col('color', 'Couleur', '#000000'), K.sl('radius', 'Arrondi', 0, 40, 2));
    if (st !== 'none') kids.push(
      row('Position', selectField(MVP_POS, () => read().pos || 'tr', v => K.set('pos', v === 'tr' ? null : v))),
      h('div', { class: 'grid2' },
        num('↔', () => read().dx || 0, v => K.set('dx', Math.round(v) || null), { unit: 'px', dec: 0 }),
        num('↕', () => read().dy || 0, v => K.set('dy', Math.round(v) || null), { unit: 'px', dec: 0 })),
      row('Animation', selectField(MVP_LOOPS, () => read().loop || 'none', v => K.set('loop', v === 'none' ? null : v), { rebuild: true })),
      read().loop ? K.sl('loopDur', 'Durée', .3, 6, 1.6, { unit: ' s', step: .1, dec: 1 }) : null);
  }
  kids.push(note(mode === 'off' ? 'Aucun badge ni mise en valeur.' : 'Le badge s\'affiche dans la case du pseudo. <b>Au-dessus du pseudo</b> le fait dépasser du tableau ; les flèches ↔ ↕ l\'ajustent au pixel près.'));
  const out = [sec('MVP', 'star', ...kids)];
  if (mode !== 'off') out.push(sec('Colonne du MVP', 'star',
    K.col('headBg', 'Fond du pseudo'), K.col('nameColor', 'Couleur du pseudo'), K.col('colBg', 'Fond de la colonne'), K.col('valColor', 'Couleur des stats'),
    K.sl('borderW', 'Contour', 0, 10, 0), K.sl('glow', 'Lueur', 0, 60, 0), K.col('glowC', 'Couleur contour / lueur', '#ffd700'),
    note('Met en valeur toute la colonne du MVP. Couleurs vides = inchangées.')));
  return out;
}

/* Victoire de la série : réglages communs + ceux de la partie sélectionnée (titre, logo, nom, sous-titre, score) */
function winSections(E) {
  const read = () => S.p.win || {}, ensure = () => (S.p.win ||= {});
  const meas = measureIn('#win-screen', [
    ['glowSize', '#win-glow', 'w'], ['barH', '#win-bar-top', 'h'], ['gap', '#win-content', 'rowGap'],
    ['labelSize', '#win-label', 'fontSize'], ['labelSpacing', '#win-label', 'letterSpacing'], ['logoSize', '#win-logo-wrap', 'w'],
    ['nameSize', '#win-team-name', 'fontSize'], ['nameSpacing', '#win-team-name', 'letterSpacing'],
    ['subSize', '#win-subtitle', 'fontSize'], ['subSpacing', '#win-subtitle', 'letterSpacing'],
    ['scoreSize', '#win-series-score', 'fontSize'], ['scoreSpacing', '#win-series-score', 'letterSpacing']]);
  const K = cfgKit(read, ensure, () => meas);
  const out = [sec('Victoire de la série', 'trophy',
    note('Affiché quand une équipe remporte la série (BO). Aperçu avec une victoire fictive 3 – 2.'),
    winnerPick(),
    h('div', { class: 'btns', style: 'margin-bottom:10px' }, btn('Tester la victoire', 'play', () => playTest('win'), 'primary')),
    varCol('--win-bg', 'Fond'), K.col('accent', 'Couleur d\'accent'),
    K.tog('noGlow', 'Halo lumineux', true), read().noGlow ? null : K.sl('glowSize', 'Taille du halo', 100, 2000, 800),
    K.tog('noBars', 'Barres haut / bas', true), read().noBars ? null : K.sl('barH', 'Épaisseur des barres', 1, 80, 4),
    K.tog('noShine', 'Reflet qui passe', true),
    K.sl('gap', 'Écart entre les textes', 0, 160, 14),
    note('Accent vide = couleur de l\'équipe gagnante (halo et barres). Pour un écran 100 % perso : calques avec <b>Afficher pendant : Victoire</b>, texte <b>{winner}</b>, logo <b>Équipe gagnante</b>.'))];
  const part = WIN_PARTS[E.key];
  if (part === 'label') out.push(sec('Titre', 'text',
    K.txt('label', 'Texte', 'SERIES WINNER', { max: 40 }), K.sl('labelSize', 'Taille', 6, 140, 13),
    K.col('labelColor', 'Couleur', 'rgba(255,255,255,0.45)'), K.sl('labelSpacing', 'Espacement', -5, 40, 8)));
  if (part === 'logo') out.push(sec('Logo', 'shield',
    K.sl('logoSize', 'Taille', 40, 700, 150),
    note('Logo de l\'équipe gagnante (réglé dans le panneau de contrôle). Lueur et teinte : section <b>Apparence</b>.')));
  if (part === 'name') out.push(sec('Nom de l\'équipe', 'text',
    K.sl('nameSize', 'Taille', 20, 300, 78), K.col('nameColor', 'Couleur'),
    row('Italique', toggle(() => read().nameItalic !== false, v => K.set('nameItalic', v ? null : false))),
    K.sl('nameSpacing', 'Espacement', -5, 40, 4),
    K.sl('nameStroke', 'Contour', 0, 12, 0, { step: .5, dec: 1 }), K.col('nameStrokeC', 'Couleur contour', '#000000'),
    K.sl('nameGlow', 'Lueur', 0, 80, 0), K.col('nameGlowC', 'Couleur lueur'),
    note('Couleur vide = couleur de l\'équipe gagnante.')));
  if (part === 'sub') out.push(sec('Sous-titre', 'text',
    K.txt('sub', 'Texte', 'REMPORTE LA SÉRIE', { max: 50 }), K.sl('subSize', 'Taille', 6, 100, 13),
    K.col('subColor', 'Couleur', 'rgba(255,255,255,0.4)'), K.sl('subSpacing', 'Espacement', -5, 40, 6)));
  if (part === 'score') out.push(sec('Score de la série', 'pips',
    K.sl('scoreSize', 'Taille', 10, 240, 38), K.col('scoreColor', 'Couleur', 'rgba(255,255,255,0.75)'), K.sl('scoreSpacing', 'Espacement', -5, 40, 8)));
  if (part) {
    const aRead = () => (read().anim || {})[part] || {};
    const aEnsure = () => { const w = ensure(); w.anim ||= {}; return (w.anim[part] ||= {}); };
    const A = cfgKit(aRead, aEnsure);
    const custom = aRead().in && aRead().in !== 'none';
    const replayWin = () => setTimeout(() => setScene('win', true), 40);
    out.push(sec('Animation d\'entrée', 'play',
      row('Entrée', selectField([['', 'Celle du thème'], ['none', 'Aucune (affiché direct)'], ...IN_ANIMS.filter(a => a[0] !== 'none')], () => aRead().in || '', v => { A.set('in', v || null); replayWin(); }, { rebuild: true })),
      custom ? h('div', { class: 'grid2' },
        num('Durée', () => aRead().dur ?? .6, v => A.set('dur', clamp(v, .1, 5)), { unit: 's', step: .05, dec: 2, scrub: .2 }),
        num('Délai', () => aRead().delay ?? WIN_DELAY[part], v => A.set('delay', clamp(v, 0, 10)), { unit: 's', step: .05, dec: 2, scrub: .2 })) : null,
      custom ? row('Courbe', selectField(EASE_OPTS, () => aRead().ease || 'smooth', v => { A.set('ease', v); replayWin(); })) : null,
      h('div', { class: 'btns' }, btn('Rejouer', 'play', replayWin))));
  }
  return out;
}

/* Calque Série : équipe, style (bâtons / rectangles / ronds / texte), couleurs + aperçu du score de série */
function seriesSections(L) {
  const r = L.series ||= {};
  const st = r.style || 'rects';
  const teamCol = () => r.team === 'orange' ? 'var(--orange)' : 'var(--blue)';
  const kids = [
    row('Équipe', selectField([['blue', 'Équipe bleue'], ['orange', 'Équipe orange']], () => r.team || 'blue', v => {
      if (!L.name || /^Série équipe/.test(L.name)) L.name = `Série équipe ${v === 'orange' ? 'orange' : 'bleue'}`;
      r.team = v;
    }, { level: 'layers', layers: true })),
    row('Style', selectField([['rects', 'Rectangles remplis'], ['bars', 'Bâtons'], ['dots', 'Ronds'], ['text', 'Texte']], () => st, v => { r.style = v; }, { level: 'layers', rebuild: true })),
  ];
  if (st === 'text') {
    kids.push(
      row('Affiche', selectField([['wins', 'Victoires (2)'], ['need', 'Victoires / à gagner (2 / 3)'], ['series', 'Score de série (2 - 1)'], ['bo', 'GAME X - BOX']], () => r.fmt || 'wins', v => { r.fmt = v; }, { level: 'layers' })),
      row('Police', selectField(fontOptions(null), () => r.font || 'Barlow Condensed', v => fontSetter(v, f => { r.font = f || 'Barlow Condensed'; changed('css', { commit: 'now' }); }))),
      h('div', { class: 'grid2' }, num('Taille', () => r.size || 48, v => { r.size = clamp(v, 6, 400); }, { unit: 'px', dec: 0, scrub: .5 }),
        selectField([['600', 'Semi-gras'], ['700', 'Gras'], ['800', 'Extra-gras'], ['900', 'Black']], () => String(r.weight || 900), v => { r.weight = +v; })),
      row('Couleur', colorField(() => r.color || '', v => { r.color = v; }, { reset: () => { delete r.color; }, isSet: () => !!r.color })),
      note(`Vide = couleur de l'équipe (${r.team === 'orange' ? 'orange' : 'bleue'}).`));
  } else {
    kids.push(
      row('Sens', selectField([['ltr', 'Gauche → droite'], ['rtl', 'Droite → gauche']], () => r.dir || 'ltr', v => { r.dir = v; }, { level: 'layers' })),
      row('Vertical', toggle(() => !!r.vertical, v => { r.vertical = v; if (v && L.w > L.h) { const t = L.w; L.w = L.h; L.h = t; } else if (!v && L.h > L.w) { const t = L.w; L.w = L.h; L.h = t; } }, { level: 'layers' })),
      row('Gagnée', colorField(() => r.on || '', v => { r.on = v; }, { reset: () => { delete r.on; }, isSet: () => !!r.on })),
      row('Vide', colorField(() => r.off ?? 'rgba(255,255,255,0.16)', v => { r.off = v; })),
      row('Espacement', slider(() => r.gap ?? 6, v => { r.gap = v; }, { max: 40, unit: ' px' })),
      st !== 'dots' ? row('Arrondi', slider(() => r.radius ?? 3, v => { r.radius = v; }, { max: 40, unit: ' px' })) : null,
      st === 'bars' ? row('Épaisseur', slider(() => r.bw ?? 8, v => { r.bw = v; }, { min: 2, max: 60, unit: ' px' })) : null,
      row('Bordure', slider(() => r.borderW || 0, v => { r.borderW = v; }, { max: 8, unit: ' px' })),
      r.borderW ? row('Couleur bordure', colorField(() => r.borderC || '#ffffff', v => { r.borderC = v; })) : null,
      note(`Vide = couleur de l'équipe. Le nombre de cases suit le BO : BO5 → 3, BO7 → 4.`));
  }
  kids.push(row('Lueur', slider(() => r.glow || 0, v => { r.glow = v; }, { max: 30, unit: ' px' })));
  void teamCol;
  /* aperçu (non enregistré) : score de série et BO simulés dans l'aperçu */
  const f = F(), cur = (f && f.series) || { blue: 0, orange: 0, bo: 5 };
  const ps = { blue: cur.blue, orange: cur.orange, bo: cur.bo };
  const apply = () => { const ff = F(); if (ff) ff.setSeries(ps.blue, ps.orange, ps.bo); };
  const prev = sec('Aperçu de la série', 'play',
    note('Pour voir le rendu : score de série simulé (l\'overlay réel suit le score du panneau).'),
    h('div', { class: 'grid3' },
      num('B', () => ps.blue, v => { ps.blue = clamp(Math.round(v), 0, 9); apply(); }, { dec: 0, level: 'css' }),
      num('O', () => ps.orange, v => { ps.orange = clamp(Math.round(v), 0, 9); apply(); }, { dec: 0, level: 'css' }),
      selectField([['0', 'Sans BO'], ['1', 'BO1'], ['3', 'BO3'], ['5', 'BO5'], ['7', 'BO7'], ['9', 'BO9']], () => String(ps.bo), v => { ps.bo = +v; apply(); return false; })));
  return [sec('Série', 'pips', ...kids), prev];
}
/* Calque Jauge de boost : style, couleurs, chiffre */
function boostSection(L) {
  const b = L.boost ||= {};
  const st = b.style || 'bar', round_ = st === 'ring' || st === 'arc';
  return sec('Jauge de boost', 'gauge',
    row('Style', selectField([['bar', 'Barre'], ['vbar', 'Barre verticale'], ['segments', 'Segments'], ['ring', 'Anneau'], ['arc', 'Arc (3/4, réglable)'], ['number', 'Chiffre seul']], () => st, v => {
      b.style = v;
      if ((v === 'ring' || v === 'arc') && Math.abs(L.w - L.h) > 4) { const s = clamp(Math.max(L.w, L.h), 80, 260); L.x += (L.w - s) / 2; L.y += (L.h - s) / 2; L.w = L.h = s; }
      if (v === 'vbar' && L.w > L.h) { const t = L.w; L.w = L.h; L.h = t; }
      if ((v === 'bar' || v === 'segments') && L.h > L.w) { const t = L.w; L.w = L.h; L.h = t; }
    }, { level: 'layers', rebuild: true })),
    st !== 'number' ? row('Couleur', colorField(() => b.fill || '', v => { b.fill = v; }, { reset: () => { delete b.fill; }, isSet: () => !!b.fill })) : null,
    st !== 'number' ? row('Fond de la jauge', colorField(() => b.track ?? 'rgba(255,255,255,0.14)', v => { b.track = v; })) : null,
    round_ ? row('Épaisseur', slider(() => b.bw ?? 9, v => { b.bw = v; }, { min: 2, max: 30 })) : null,
    ...(round_ ? arcControls(k => b[k], (k, v) => { if (v === null || v === undefined) delete b[k]; else b[k] = v; }, { full: st === 'ring' }) : []),
    !round_ && st !== 'number' ? row('Arrondi', slider(() => b.radius ?? 8, v => { b.radius = v; }, { max: 60, unit: ' px' })) : null,
    st === 'segments' ? row('Segments', slider(() => b.segs || 10, v => { b.segs = v; }, { min: 3, max: 30, level: 'layers' })) : null,
    st === 'segments' ? row('Espacement', slider(() => b.gap ?? 4, v => { b.gap = v; }, { max: 20, unit: ' px' })) : null,
    row('Lueur', slider(() => b.glow || 0, v => { b.glow = v; }, { max: 30, unit: ' px' })),
    row('Fond', colorField(() => b.bg || '', v => { b.bg = v; }, { reset: () => { delete b.bg; }, isSet: () => !!b.bg })),
    row('Chiffre', selectField([['center', 'Au centre'], ['left', 'À gauche'], ['right', 'À droite'], ['off', 'Masqué']], () => b.num || 'center', v => { b.num = v; }, { level: 'layers' })),
    b.num !== 'off' ? h('div', { class: 'grid2' }, num('Taille', () => b.numSize ?? 40, v => { b.numSize = clamp(v, 6, 300); }, { unit: 'px', dec: 0, scrub: .5 }),
      colorField(() => b.numColor || '#ffffff', v => { b.numColor = v; }, { alpha: false })) : null,
    b.num !== 'off' ? row('Police', selectField(fontOptions(null), () => b.font || 'Barlow Condensed', v => fontSetter(v, f => { b.font = f || 'Barlow Condensed'; changed('css', { commit: 'now' }); }))) : null,
    note('Suit le boost du joueur suivi, à la couleur de son équipe (vide = couleur d\'équipe). Masquée quand aucun joueur n\'est suivi.'));
}

/* Bandeau médias : taille, fond, marge et ajustement — les médias s'adaptent à la taille */
function mediaSections(get, set, o = {}) {
  const m = () => get() || {};
  const upd = (k, v) => { const x = { ...m() }; if (v === null || v === undefined) delete x[k]; else x[k] = v; set(x); };
  return sec('Bandeau médias', 'media',
    note('Affiche les images et vidéos du <b>bandeau médias</b> du panneau de contrôle, qui défilent selon la durée réglée là-bas. Elles s\'adaptent toutes seules à la taille du bandeau.'),
    o.size ? h('div', { class: 'grid2' }, num('L', () => m().w ?? o.size.w, v => upd('w', clamp(Math.round(v), 40, 1920)), { dec: 0 }), num('H', () => m().h ?? o.size.h, v => upd('h', clamp(Math.round(v), 30, 1080)), { dec: 0 })) : null,
    row('Fond', colorField(() => m().bg ?? 'rgba(0,0,0,0.27)', v => upd('bg', v), { reset: () => upd('bg', null), isSet: () => m().bg != null })),
    row('Arrondi', slider(() => m().radius ?? 8, v => upd('radius', v), { max: 80, unit: ' px' })),
    row('Bordure', slider(() => m().borderW ?? 0, v => upd('borderW', v), { max: 20, unit: ' px' })),
    row('Couleur bordure', colorField(() => m().borderC ?? '#ffffff', v => upd('borderC', v))),
    row('Marge des logos', slider(() => m().pad ?? 10, v => upd('pad', v), { max: 80, unit: ' px' })),
    row('Images', selectField([['contain', 'Entières (contenir)'], ['cover', 'Remplir (rogner)'], ['fill', 'Étirer']], () => m().fit || 'contain', v => upd('fit', v))),
    row('Vidéos', selectField([['cover', 'Remplir (rogner)'], ['contain', 'Entières (contenir)'], ['fill', 'Étirer']], () => m().vfit || 'cover', v => upd('vfit', v))));
}

function renderElProps() {
  const E = EL[S.sel.id], d = elData(E.key);
  const A = () => selectedAabb() || { l: 0, t: 0 };
  insp.append(inspTitle(E.icon, elName(E.key), d.name ? `${E.label} · ${SCENES[E.scene]}` : `Élément de l'overlay · ${SCENES[E.scene]}`));
  insp.append(sec('Position', 'pointer',
    row('Nom', textInput(() => d.name || '', v => { const t = v.replace(/\s+/g, ' ').trim(); if (t && t !== E.label) d.name = t; else delete d.name; }, { max: 40, placeholder: E.label, layers: true })),
    h('div', { class: 'grid2' },
      num('X', () => round(A().l), v => { d.x = round((d.x || 0) + v - A().l, 1); }),
      num('Y', () => round(A().t), v => { d.y = round((d.y || 0) + v - A().t, 1); })),
    h('div', { class: 'grid2' },
      num('⤢', () => (d.s ?? 1) * 100, v => { d.s = round(clamp(v, 10, 600) / 100, 4); }, { unit: '%', dec: 0 }),
      num('↻', () => d.r || 0, v => { d.r = round(((v + 540) % 360) - 180, 1); }, { unit: '°' })),
    iconRow(ALIGN_DEFS, null, alignSel),
    h('div', { class: 'btns' }, btn('Réinitialiser', 'replay', () => { delete d.x; delete d.y; delete d.s; delete d.r; changed('css', { commit: 'now', layers: true }); }))));
  if (E.key === 'sidebar-blue' || E.key === 'sidebar-orange') sidebarSections(E.key.slice(8)).forEach(s => insp.append(s));
  if (E.key === 'goal-notif') goalSections(d).forEach(s => insp.append(s));
  if (E.scene === 'end') endSections(E, d).forEach(s => insp.append(s));
  if (E.scene === 'win') winSections(E).forEach(s => insp.append(s));
  if (E.scene === 'game') insp.append(sec('Moments', 'clock',
    note('Masque cet élément pendant certains moments du match (il revient tout seul après).'),
    h('div', { class: 'lbl', style: 'width:auto;margin-bottom:6px' }, 'Masquer pendant'),
    chipToggles([['goal', 'But'], ['wreplay', 'Anim. REPLAY'], ['replay', 'Replay'], ['wlive', 'Anim. LIVE'], ['ot', 'Prolongation']], k => (d.hideIn || []).includes(k), k => {
      const s = new Set(d.hideIn || []);
      if (s.has(k)) s.delete(k); else s.add(k);
      if (s.size) d.hideIn = [...s]; else delete d.hideIn;
      changed('css', { commit: 'now', layers: true });
    })));
  if (E.key === 'stat-bar') statBarSections(d).forEach(s => insp.append(s));
  if (E.key === 'boost-meter') insp.append(boostMeterSection(d));
  if (E.key === 'media-banner') {
    insp.append(mediaSections(() => d.mb, x => { d.mb = x; }, { size: { w: 210, h: 100 } }));
    insp.lastChild.append(h('div', { class: 'btns', style: 'margin-top:10px' }, btn('Le placer librement (calque)', 'media', () => addLayer('media'))));
  }
  insp.append(sec('Apparence', 'palette',
    row('Opacité', slider(() => d.o ?? 100, v => { d.o = v; }, { unit: ' %' })),
    row('Teinte', slider(() => d.hue || 0, v => { d.hue = v; }, { min: -180, max: 180, unit: '°' })),
    row('Saturation', slider(() => d.sat ?? 100, v => { d.sat = v; }, { max: 200, unit: ' %' })),
    row('Luminosité', slider(() => d.bright ?? 100, v => { d.bright = v; }, { min: 20, max: 200, unit: ' %' })),
    row('Lueur', slider(() => (d.glow && d.glow.size) || 0, v => { d.glow = { ...(d.glow || { color: '#ffffff' }), size: v }; }, { max: 40, unit: ' px' })),
    row('Couleur lueur', colorField(() => (d.glow && d.glow.color) || '#ffffff', v => { d.glow = { ...(d.glow || { size: 12 }), color: v }; }, { alpha: true })),
    note('La <b>teinte</b> recolore tout l\'élément, quel que soit le thème de base. Les couleurs précises se règlent dans l\'onglet <b>Thème</b>.')));
  insp.append(sec('Texte', 'text',
    row('Police', selectField(fontOptions('Police du thème'), () => d.font || '', v => fontSetter(v, f => { d.font = f || undefined; if (!f) delete d.font; changed('css', { commit: 'now' }); })))));
  insp.append(sec('Calque', 'layers',
    row('Visible', toggle(() => !d.hidden, v => { if (v) delete d.hidden; else d.hidden = true; }, { layers: true })),
    row('Verrouillé', toggle(() => !!d.locked, v => { if (v) d.locked = true; else delete d.locked; }, { layers: true }))));
}

function renderLayerProps() {
  const L = layerById(S.sel.id);
  if (!L) return;
  const typeName = { image: 'Image', video: 'Vidéo', text: 'Texte', shape: 'Forme', lottie: 'Animation Lottie', logo: 'Logo d\'équipe', media: 'Bandeau médias', series: 'Série', boost: 'Jauge de boost' }[L.type];
  const grp = groupOf(L);
  insp.append(inspTitle(layerIcon(L).replace(/^<div class="l-ico">|<\/div>$/g, ''), L.name || typeName, typeName + (grp ? ` · dans « ${grp.name} »` : ' · calque ajouté')));
  if (grp) insp.append(h('div', { class: 'sec' }, h('div', { class: 'btns' },
    btn('Sélectionner le dossier', 'folderOpen', () => select({ kind: 'group', id: grp.id })),
    btn('Sortir du dossier', 'x', () => leaveGroup(L.id)))));
  insp.append(sec('Position & taille', 'pointer',
    row('Nom', textInput(() => L.name || '', v => { L.name = v.replace(/\s+/g, ' ').slice(0, 40); }, { max: 40, placeholder: typeName, layers: true })),
    h('div', { class: 'grid2' }, num('X', () => L.x, v => { L.x = v; }), num('Y', () => L.y, v => { L.y = v; })),
    h('div', { class: 'grid2' }, num('L', () => L.w, v => { L.w = Math.max(4, v); }, { min: 4 }), num('H', () => L.h, v => { L.h = Math.max(4, v); }, { min: 4 })),
    h('div', { class: 'grid2' }, num('↻', () => L.r || 0, v => { L.r = round(((v + 540) % 360) - 180, 1); }, { unit: '°' }),
      h('div', { class: 'btns', style: 'justify-content:flex-end' },
        btn('', 'flipH', () => { L.flipX = !L.flipX; changed('css', { commit: 'now' }); }), btn('', 'flipV', () => { L.flipY = !L.flipY; changed('css', { commit: 'now' }); }))),
    iconRow(ALIGN_DEFS, null, alignSel),
    ['image', 'video', 'lottie'].includes(L.type) ? h('div', { class: 'btns' }, btn('Plein écran', 'fit', () => { Object.assign(L, { x: 0, y: 0, w: W, h: H, r: 0 }); changed('css', { commit: 'now' }); })) : null));
  if (L.type === 'media') insp.append(mediaSections(() => L.media, x => { L.media = x; }));
  if (L.type === 'series') seriesSections(L).forEach(s => insp.append(s));
  if (L.type === 'boost') insp.append(boostSection(L));
  if (L.type === 'logo') {
    insp.append(sec('Logo d\'équipe', 'shield',
      row('Équipe', selectField(TEAM_OPTS, () => L.team || 'blue', v => {
        if (!L.name || /^Logo équipe/.test(L.name)) L.name = 'Logo ' + TEAM_OPTS.find(o => o[0] === v)[1].toLowerCase();
        L.team = v;
      }, { level: 'layers', layers: true })),
      row('Ajustement', selectField([['contain', 'Contenir'], ['cover', 'Remplir (rogner)'], ['fill', 'Étirer']], () => L.fit || 'contain', v => { L.fit = v; })),
      note('Affiche automatiquement le logo réglé dans le panneau de contrôle (carte Équipes). <b>Équipe qui marque</b> : le logo de l\'équipe qui vient de marquer — idéal avec <b>Afficher : pendant un but</b>.')));
  }
  insp.append(sec('Affichage', 'eye',
    h('div', { class: 'lbl', style: 'width:auto;margin-bottom:6px' }, 'Afficher pendant'),
    chipToggles(MOMENTS, k => showList(L).includes(k), k => {
      let s = showList(L).filter(x => x !== 'always');
      if (k === 'always') s = ['always'];
      else if (s.includes(k)) { s = s.filter(x => x !== k); if (!s.length) return; }
      else s.push(k);
      L.show = MOMENTS.map(m => m[0]).filter(m => s.includes(m));
      changed('layers', { commit: 'now', layers: true, inspector: k === 'wreplay' || k === 'wlive' });
      if (!layerVisibleInScene(L)) { const sc = SHOW_SCENE[L.show.find(m => m !== 'always')]; if (sc) setScene(sc, true); }
    }),
    note('Le calque n\'apparaît qu\'aux moments choisis (plusieurs possibles). <b>En jeu</b> = pendant le jeu, hors but, replay et animations de transition. Un seul moment à la fois : dès que l\'animation REPLAY démarre, ce n\'est plus « But ».'),
    showList(L).includes('wreplay') ? wipeToggle('replay') : null,
    showList(L).includes('wlive') ? wipeToggle('live') : null,
    showList(L).some(m => m === 'wreplay' || m === 'wlive') ? note('Décoche l\'animation de base pour que ton calque la remplace au lieu de s\'y superposer.') : null,
    row('Plan', selectField([['front', 'Devant l\'overlay'], ['back', 'Derrière l\'overlay']], () => L.z || 'front', v => { L.z = v; }, { level: 'layers', layers: true })),
    row('Opacité', slider(() => L.o ?? 100, v => { L.o = v; }, { unit: ' %' })),
    row('Fusion', selectField(BLENDS, () => L.blend || 'normal', v => { L.blend = v; }))));

  if (L.type === 'image' || L.type === 'video' || L.type === 'lottie') {
    const kids = [fileRow(null, () => L.asset, id => { L.asset = id; }, L.type === 'lottie' ? ACCEPT.lottie : L.type === 'video' ? ACCEPT.video : ACCEPT.image, { level: 'layers' })];
    if (L.type !== 'lottie') kids.push(row('Ajustement', selectField([['contain', 'Contenir'], ['cover', 'Remplir (rogner)'], ['fill', 'Étirer']], () => L.fit || 'contain', v => { L.fit = v; })));
    if (L.type === 'video') kids.push(row('Lire jusqu\'au bout', toggle(() => !!L.toEnd, v => { if (v) { L.toEnd = true; L.loop = false; } else delete L.toEnd; }, { level: 'layers', rebuild: true })),
      note(L.toEnd ? 'Jouée une fois à chaque déclenchement et <b>affichée jusqu\'à sa fin</b>, même quand le moment se termine. Idéal pour une transition REPLAY / LIVE perso : le moment « Anim. REPLAY » ne dure que 1,6 s.'
        : 'Active-le pour une vidéo de transition plus longue que son moment (sinon elle est coupée quand le moment se termine).'));
    if (L.type !== 'image' && !L.toEnd) kids.push(row('En boucle', toggle(() => L.loop !== false, v => { L.loop = v; }, { level: 'layers' })),
      note(L.loop === false ? 'Joué une fois à chaque déclenchement (ex. à chaque but).' : 'Tourne en boucle tant que le calque est affiché.'));
    insp.append(sec(L.type === 'lottie' ? 'Animation Lottie' : L.type === 'video' ? 'Vidéo' : 'Image', L.type === 'lottie' ? 'sparkle' : L.type, ...kids));
  }
  if (L.type === 'text') {
    const t = L.text;
    const ta = textInput(() => t.content, v => { t.content = v; }, { area: true, id: 'insp-text', level: 'layers', rows: 2 });
    insp.append(sec('Texte', 'text', ta,
      note('Données en direct : clique pour insérer'),
      h('div', { class: 'chips', style: 'margin-bottom:12px' }, TOKENS.map(([k, l]) => h('button', { class: 'chip tok', title: l, onclick: () => {
        const p = ta.selectionStart ?? t.content.length;
        t.content = t.content.slice(0, p) + `{${k}}` + t.content.slice(ta.selectionEnd ?? p);
        ta.value = t.content; changed('layers', { commit: 'now' });
      } }, `{${k}}`))),
      row('Police', selectField(fontOptions(null), () => t.font, v => fontSetter(v, f => { t.font = f || 'Barlow Condensed'; changed('css', { commit: 'now' }); }))),
      h('div', { class: 'grid2' }, num('Taille', () => t.size, v => { t.size = clamp(v, 6, 600); }, { unit: 'px', dec: 0, scrub: .5 }),
        selectField([['400', 'Normal'], ['600', 'Semi-gras'], ['700', 'Gras'], ['800', 'Extra-gras'], ['900', 'Black']], () => String(t.weight), v => { t.weight = +v; })),
      row('Couleur', colorField(() => t.color, v => { t.color = v; })),
      row('Dégradé', toggle(() => t.grad.on, v => { t.grad.on = v; }, { rebuild: true })),
      t.grad.on ? row('2ᵉ couleur', colorField(() => t.grad.color2, v => { t.grad.color2 = v; })) : null,
      t.grad.on ? row('Angle', slider(() => t.grad.angle ?? 90, v => { t.grad.angle = v; }, { max: 360, unit: '°' })) : null,
      iconRow([['left', 'txL', 'Aligné à gauche'], ['center', 'txC', 'Centré'], ['right', 'txR', 'Aligné à droite']], k => (t.align || 'center') === k, k => { t.align = k; changed('css', { commit: 'now' }); }),
      row('Espacement', slider(() => t.spacing || 0, v => { t.spacing = v; }, { min: -5, max: 30, unit: ' px' })),
      row('Majuscules', toggle(() => t.upper, v => { t.upper = v; })),
      row('Italique', toggle(() => t.italic, v => { t.italic = v; })),
      row('Masquer si vide', toggle(() => !!t.hideEmpty, v => { if (v) t.hideEmpty = true; else delete t.hideEmpty; }, { level: 'layers' })),
      note('Cache le calque quand une donnée en direct est vide — ex. <b>PASSE D : {assist}</b> disparaît s\'il n\'y a pas de passeur.'),
      row('Contour', slider(() => t.stroke.w, v => { t.stroke.w = v; }, { max: 12, step: .5, dec: 1, unit: ' px' })),
      row('Couleur contour', colorField(() => t.stroke.color, v => { t.stroke.color = v; })),
      row('Lueur', slider(() => t.glow.size, v => { t.glow.size = v; }, { max: 40, unit: ' px' })),
      row('Couleur lueur', colorField(() => t.glow.color, v => { t.glow.color = v; }))));
  }
  if (L.type === 'shape') {
    const sh = L.shape;
    sh.border ||= { w: 0, color: '#ffffff' };
    sh.glow ||= { size: 0, color: '#3d7bff' };
    sh.grad ||= { on: false, color2: '#9b5cff', angle: 135 };
    const poly = !!polyPts(sh), rectLike = !poly && sh.kind !== 'ellipse';
    const kinds = sh.kind === 'custom' ? [...SHAPES, ['custom', 'Libre (déformée)']] : SHAPES;
    insp.append(sec('Forme', 'shape',
      row('Forme', selectField(kinds, () => sh.kind, v => { sh.kind = v; if (v !== 'custom') delete sh.pts; }, { rebuild: true, layers: true })),
      row('Couleur', colorField(() => sh.fill, v => { sh.fill = v; renderLayers(); })),
      row('Dégradé', toggle(() => sh.grad.on, v => { sh.grad.on = v; }, { rebuild: true })),
      sh.grad.on ? row('2ᵉ couleur', colorField(() => sh.grad.color2, v => { sh.grad.color2 = v; })) : null,
      sh.grad.on ? row('Angle', slider(() => sh.grad.angle ?? 135, v => { sh.grad.angle = v; }, { max: 360, unit: '°' })) : null,
      row('Lueur', slider(() => sh.glow.size, v => { sh.glow.size = v; }, { max: 60, unit: ' px' })),
      row('Couleur lueur', colorField(() => sh.glow.color, v => { sh.glow.color = v; }))));
    /* angles : inclinaison des côtés + déformation libre des coins */
    insp.append(sec('Angles', 'shape',
      note('Sur le canevas : <b>Ctrl</b> (ou <b>Maj</b>) + glisser un <b>côté</b> pour l\'incliner · <b>Ctrl</b> + glisser un <b>coin</b> pour le déplacer librement (Ctrl+Maj : par pas de 15°). Le coin s\'aimante aux bords seulement tout près : maintiens <b>Alt</b> pour aucun aimant. Pour un réglage au dixième, tape la valeur dans les cases (flèches ↑ ↓ : 0,1 %).'),
      h('div', { class: 'grid2' },
        num('↔', () => sh.skx || 0, v => { sh.skx = clamp(round(v, 1), -75, 75); if (!sh.skx) delete sh.skx; }, { unit: '°', dec: 1 }),
        num('↕', () => sh.sky || 0, v => { sh.sky = clamp(round(v, 1), -75, 75); if (!sh.sky) delete sh.sky; }, { unit: '°', dec: 1 })),
      sh.kind === 'custom' ? h('div', { class: 'grid2' }, ...['↖ Haut gauche', '↗ Haut droite', '↘ Bas droite', '↙ Bas gauche'].flatMap((lbl, i) => [
        num(lbl.slice(0, 1) + 'X', () => sh.pts[i][0], v => { sh.pts[i][0] = round(clamp(v, 0, 100), 1); }, { unit: '%', dec: 1, step: .1, scrub: .5 }),
        num(lbl.slice(0, 1) + 'Y', () => sh.pts[i][1], v => { sh.pts[i][1] = round(clamp(v, 0, 100), 1); }, { unit: '%', dec: 1, step: .1, scrub: .5 })])) : null,
      (sh.skx || sh.sky || sh.kind === 'custom') ? h('div', { class: 'btns' }, btn('Remettre droit', 'replay', () => {
        delete sh.skx; delete sh.sky;
        if (sh.kind === 'custom') { sh.kind = 'rect'; delete sh.pts; }
        changed('css', { commit: 'now', inspector: true });
      })) : null));
    /* coins arrondis : un réglage pour les 4, ou chaque coin séparément (rectangle) */
    if (rectLike) insp.append(sec('Coins', 'shape',
      row('Coins séparés', toggle(() => !!sh.radii, v => {
        if (v) { const r = sh.radius || 0; sh.radii = [r, r, r, r]; } else { sh.radius = sh.radii ? Math.max(...sh.radii) : 0; delete sh.radii; }
      }, { rebuild: true })),
      sh.radii
        ? h('div', { class: 'grid2' },
          num('↖', () => sh.radii[0], v => { sh.radii[0] = Math.max(0, Math.round(v)); }, { unit: 'px', dec: 0 }),
          num('↗', () => sh.radii[1], v => { sh.radii[1] = Math.max(0, Math.round(v)); }, { unit: 'px', dec: 0 }),
          num('↙', () => sh.radii[3], v => { sh.radii[3] = Math.max(0, Math.round(v)); }, { unit: 'px', dec: 0 }),
          num('↘', () => sh.radii[2], v => { sh.radii[2] = Math.max(0, Math.round(v)); }, { unit: 'px', dec: 0 }))
        : row('Arrondi', slider(() => sh.radius || 0, v => { sh.radius = v; }, { max: 200, unit: ' px' }))));
    else if (poly) insp.append(sec('Coins', 'shape', note('Les coins arrondis ne s\'appliquent qu\'aux rectangles (pas aux formes à angles).')));
    /* bordure : épaisseur, couleur et côtés (haut / droite / bas / gauche) */
    const sides = () => sh.border.sides || { t: 1, r: 1, b: 1, l: 1 };
    const setSide = k => {
      const s = { ...sides() };
      if (k === 'all') { const all = SIDES.every(x => s[x]); SIDES.forEach(x => { s[x] = all ? 0 : 1; }); }
      else s[k] = s[k] ? 0 : 1;
      if (SIDES.every(x => s[x])) delete sh.border.sides; else sh.border.sides = s;
      if (!sh.border.w) sh.border.w = 3;
      changed('css', { commit: 'now' });
    };
    insp.append(sec('Bordure', 'shape',
      row('Épaisseur', slider(() => sh.border.w || 0, v => { sh.border.w = v; }, { max: 30, unit: ' px' })),
      row('Couleur', colorField(() => sh.border.color || '#ffffff', v => { sh.border.color = v; })),
      h('div', { class: 'lbl', style: 'width:auto;margin:4px 0 6px' }, 'Côtés'),
      iconRow([['all', 'bAll', 'Tous les côtés'], ['t', 'bT', 'Haut'], ['r', 'bR', 'Droite'], ['b', 'bB', 'Bas'], ['l', 'bL', 'Gauche']],
        k => k === 'all' ? SIDES.every(x => sides()[x]) : !!sides()[k], setSide),
      note('Clique un côté pour l\'allumer ou l\'éteindre : par exemple seulement à droite ou seulement en bas. Marche aussi sur les formes à angles.')));
  }
  const sd = L.shadow || { on: false, color: 'rgba(0,0,0,0.6)', blur: 16, x: 0, y: 6 };
  insp.append(sec('Ombre portée', 'layers',
    row('Activer', toggle(() => sd.on, v => { L.shadow = { ...sd, on: v }; }, { rebuild: true })),
    sd.on ? row('Couleur', colorField(() => L.shadow.color, v => { L.shadow.color = v; })) : null,
    sd.on ? h('div', { class: 'grid3' }, num('Flou', () => L.shadow.blur, v => { L.shadow.blur = Math.max(0, v); }, { dec: 0 }), num('X', () => L.shadow.x, v => { L.shadow.x = v; }, { dec: 0 }), num('Y', () => L.shadow.y, v => { L.shadow.y = v; }, { dec: 0 })) : null));
  insp.append(h('div', { class: 'sec' }, h('div', { class: 'btns' },
    btn('Dupliquer', 'copy', () => duplicateLayer(L.id)),
    btn('Premier plan', 'layers', () => moveLayer(L.id, 'top')),
    btn('Supprimer', 'trash', deleteSelection, 'danger'))));
}

function animSelectOpts(base) {
  return [...base, { group: 'Importées', items: S.p.importedAnims.map(n => ['imp:' + n, n]) }];
}
function renderLayerAnim() {
  const L = layerById(S.sel.id);
  if (!L) return;
  const a = L.anim;
  insp.append(inspTitle('zap', L.name || 'Calque', 'Animations du calque'));
  insp.append(h('div', { class: 'sec' }, h('div', { class: 'btns' },
    btn('Rejouer', 'play', () => replayLayer(L.id), 'primary'),
    btn('Importer des animations (.css)', 'upload', () => importAnimCss()))));
  insp.append(sec('Entrée', 'play',
    note(`Jouée à chaque apparition du calque (${esc(SHOW_OPTS.find(o => o[0] === (L.show || 'always'))[1].toLowerCase())}).`),
    row('Animation', selectField(animSelectOpts(IN_ANIMS), () => a.in || 'none', v => { a.in = v; setTimeout(() => replayLayer(L.id), 30); })),
    h('div', { class: 'grid2' }, num('Durée', () => a.inDur ?? .6, v => { a.inDur = clamp(v, .05, 20); }, { unit: 's', step: .05, dec: 2, scrub: .2 }),
      num('Délai', () => a.inDelay ?? 0, v => { a.inDelay = clamp(v, 0, 30); }, { unit: 's', step: .05, dec: 2, scrub: .2 })),
    row('Courbe', selectField(EASE_OPTS, () => a.inEase || 'smooth', v => { a.inEase = v; }))));
  insp.append(sec('En boucle', 'replay',
    row('Animation', selectField(animSelectOpts(LOOP_ANIMS), () => a.loop || 'none', v => { a.loop = v; }, { rebuild: true })),
    num('Durée', () => a.loopDur ?? 2, v => { a.loopDur = clamp(v, .1, 60); }, { unit: 's', step: .1, dec: 1, scrub: .2 }),
    a.loop === 'glow' ? row('Couleur lueur', colorField(() => a.glowColor || '#ffffff', v => { a.glowColor = v; })) : null));
  insp.append(sec('Sortie', 'x',
    row('Animation', selectField(OUT_ANIMS, () => a.out || 'fade', v => { a.out = v; }, { level: 'layers' })),
    a.out !== 'none' ? num('Durée', () => a.outDur ?? .35, v => { a.outDur = clamp(v, .05, 5); }, { unit: 's', step: .05, dec: 2, scrub: .2 }) : null));
  insp.append(kfEditor(L));
}
function renderElAnim() {
  const E = EL[S.sel.id], d = elData(E.key);
  insp.append(inspTitle('zap', E.label, 'Animation de l\'élément'));
  let own = false;
  try {
    const doc = FD(), st = doc.getElementById('st-studio-css'), el = elNode(doc, E);
    if (st && el) { st.disabled = true; own = frame.contentWindow.getComputedStyle(el).animationName !== 'none'; st.disabled = false; }
  } catch (e) {}
  const lp = d.loop || { name: 'none', dur: 2 };
  insp.append(sec('En boucle', 'replay',
    own ? note('Cet élément a déjà sa propre animation dans le thème de base : une animation en boucle la remplacerait.') : null,
    row('Animation', selectField(EL_LOOPS, () => lp.name || 'none', v => { d.loop = { ...lp, name: v }; if (v === 'none') delete d.loop; }, { rebuild: true })),
    lp.name && lp.name !== 'none' ? num('Durée', () => (d.loop && d.loop.dur) || 2, v => { d.loop = { ...(d.loop || lp), dur: clamp(v, .2, 30) }; }, { unit: 's', step: .1, dec: 1, scrub: .2 }) : null,
    lp.name === 'glow' ? row('Couleur', colorField(() => (d.loop && d.loop.color) || '#ffffff', v => { d.loop = { ...(d.loop || lp), color: v }; })) : null));
  insp.append(sec('Apparitions de l\'overlay', 'play',
    note('Les animations GOAL, REPLAY, fin de match et victoire viennent du thème de base. Tu peux les tester ici, ou ajouter tes propres calques animés qui se déclenchent sur ces moments.'),
    h('div', { class: 'btns' }, btn('But + replay', 'play', () => playTest('goal')), btn('Fin', 'play', () => playTest('end')), btn('Victoire', 'play', () => playTest('win')))));
}

/* Éditeur d'images clés */
function kfEditor(L) {
  const a = L.anim;
  a.kf ||= { on: false, dur: 2, delay: 0, iter: 'inf', ease: 'inout', alt: true, keys: [{ t: 0, x: 0, y: 0, s: 100, r: 0, o: 100 }, { t: 100, x: 0, y: -20, s: 100, r: 0, o: 100 }] };
  const kf = a.kf;
  const wrap = sec('Animation personnalisée', 'sparkle');
  wrap.append(row('Activer', toggle(() => kf.on, v => { kf.on = v; }, { rebuild: true })));
  if (!kf.on) { wrap.append(note('Crée ta propre animation avec des <b>images clés</b> : position, échelle, rotation et opacité à différents moments.')); return wrap; }
  kf.keys.sort((x, y) => x.t - y.t);
  S.kfSel = clamp(S.kfSel, 0, kf.keys.length - 1);
  const track = h('div', { class: 'kf-track', title: 'Clique pour ajouter une image clé' });
  const inner = h('div', { class: 'kf-inner' });
  track.append(inner);
  [0, 25, 50, 75, 100].forEach(t => inner.append(h('div', { class: 'tick', style: `left:${t}%` }, t + '%')));
  const drawKeys = () => {
    $$('.kf', inner).forEach(x => x.remove());
    kf.keys.forEach((k, i) => {
      const dmd = h('div', { class: 'kf' + (i === S.kfSel ? ' sel' : ''), style: `left:${k.t}%`, title: `${round(k.t)} %` });
      dmd.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        S.kfSel = i; renderInspector();
        if (k.t === 0 || k.t === 100) return;
        const r = inner.getBoundingClientRect();
        const mv = ev => { k.t = clamp(round((ev.clientX - r.left) / r.width * 100), 1, 99); dmdNow().style.left = k.t + '%'; changed('css', { commit: false }); };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); commit(); renderInspector(); };
        const dmdNow = () => $$('.kf', $('#inspector .kf-inner'))[i] || dmd;
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      inner.append(dmd);
    });
  };
  drawKeys();
  track.addEventListener('pointerdown', e => {
    const r = inner.getBoundingClientRect();
    const t = clamp(round((e.clientX - r.left) / r.width * 100), 1, 99);
    if (kf.keys.some(k => Math.abs(k.t - t) < 2)) return;
    const prev = [...kf.keys].reverse().find(k => k.t < t) || kf.keys[0];
    kf.keys.push({ ...prev, t });
    kf.keys.sort((x, y) => x.t - y.t);
    S.kfSel = kf.keys.findIndex(k => k.t === t);
    changed('css', { commit: 'now', inspector: true });
  });
  wrap.append(track);
  const k = kf.keys[S.kfSel];
  wrap.append(h('div', { class: 'sec-note', html: `Image clé à <b>${round(k.t)} %</b>${k.t === 0 || k.t === 100 ? ' (début / fin)' : ' — glisse le losange pour la déplacer'}` }));
  wrap.append(h('div', { class: 'grid2' }, num('X', () => k.x, v => { k.x = v; }, { unit: 'px', dec: 0 }), num('Y', () => k.y, v => { k.y = v; }, { unit: 'px', dec: 0 })));
  wrap.append(h('div', { class: 'grid3' }, num('⤢', () => k.s ?? 100, v => { k.s = clamp(v, 0, 1000); }, { unit: '%', dec: 0 }), num('↻', () => k.r || 0, v => { k.r = v; }, { unit: '°', dec: 0 }), num('α', () => k.o ?? 100, v => { k.o = clamp(v, 0, 100); }, { unit: '%', dec: 0 })));
  if (k.t !== 0 && k.t !== 100) wrap.append(h('div', { class: 'btns', style: 'margin-bottom:10px' }, btn('Supprimer cette image clé', 'trash', () => { kf.keys.splice(S.kfSel, 1); S.kfSel = 0; changed('css', { commit: 'now', inspector: true }); }, 'danger')));
  wrap.append(h('div', { class: 'grid2' }, num('Durée', () => kf.dur, v => { kf.dur = clamp(v, .1, 120); }, { unit: 's', step: .1, dec: 1, scrub: .2 }), num('Délai', () => kf.delay || 0, v => { kf.delay = clamp(v, 0, 60); }, { unit: 's', step: .1, dec: 1, scrub: .2 })));
  wrap.append(row('Répétition', selectField([['1', 'Une fois'], ['2', '2 fois'], ['3', '3 fois'], ['inf', 'En boucle']], () => String(kf.iter), v => { kf.iter = v === 'inf' ? 'inf' : +v; })));
  wrap.append(row('Courbe', selectField(EASE_OPTS, () => kf.ease || 'inout', v => { kf.ease = v; })));
  wrap.append(row('Aller-retour', toggle(() => kf.alt, v => { kf.alt = v; })));
  return wrap;
}

/* Onglet Thème */
function renderThemeTab() {
  const p = S.p;
  const doc = FD();
  const baseVal = name => { try { return frame.contentWindow.getComputedStyle(doc.body).getPropertyValue(name).trim(); } catch (e) { return ''; } };
  const themeOpts = [
    { group: 'Thèmes intégrés', items: Object.entries(BUILTIN_THEMES).filter(([id]) => id === 'rlcs' || S.themes.some(t => t.id === id)) },
    { group: 'Thèmes installés', items: S.themes.filter(t => !BUILTIN_THEMES[t.id]).map(t => [t.id, (t.label || t.name || t.id) + (t.studio ? ' (Studio)' : '')]) },
  ];
  insp.append(sec('Projet', 'layers',
    row('Nom', textInput(() => p.name, v => { p.name = v; $('#proj-name').value = v; }, { max: 40 })),
    row('Basé sur', selectField(themeOpts, () => p.base, v => { p.base = v; loadBase(v); }, { level: 'all' })),
    note('Le thème de base fournit la mise en page et les animations d\'origine. Tout ce que tu modifies ici s\'ajoute par-dessus.'),
    row('Chrono court', toggle(() => !!p.options.timerShort, v => { p.options.timerShort = v; }, { level: 'all' })),
    note('Affiche « 5:00 » au lieu de « 05:00 ».')));

  const pal = h('div', { class: 'palettes' });
  for (const P of PALETTES) {
    const sw = ['--blue', '--blue-light', '--orange', '--orange-light'].map(k => `<b style="background:${P.v[k]}"></b>`).join('');
    pal.append(h('button', { class: 'pal', title: 'Appliquer la palette ' + P.name, html: `<div class="sw">${sw}</div><span>${esc(P.name)}</span>`, onclick: () => { Object.assign(p.vars, P.v); changed('css', { commit: 'now', vars: true }); setTimeout(refreshFields, 200); } }));
  }
  insp.append(sec('Palettes rapides', 'palette', pal,
    h('div', { class: 'btns', style: 'margin-top:10px' }, btn('Revenir aux couleurs du thème de base', 'replay', () => { p.vars = {}; changed('css', { commit: 'now', vars: true }); setTimeout(refreshFields, 200); }))));
  for (const G of VAR_GROUPS) {
    insp.append(sec(G.t, null, ...G.v.map(([k, l]) => row(l, colorField(() => p.vars[k] || baseVal(k), v => { p.vars[k] = v; }, { vars: true, reset: () => { delete p.vars[k]; }, isSet: () => p.vars[k] != null })))));
  }
  insp.lastChild.append(note('Ces couleurs s\'appliquent aux thèmes simples (Default, Néon, Onyx, Nord, Amber…). Les thèmes très personnalisés peuvent en ignorer certaines : utilise alors la <b>teinte</b> de chaque élément.'));
  insp.append(sec('Tailles & durées', 'sliders', ...SIZE_VARS.map(([k, l, unit, min, max, step]) => row(l,
    slider(() => { const v = parseFloat(p.vars[k] || baseVal(k)); return isNaN(v) ? min : v; }, v => { p.vars[k] = v + unit; }, { min, max, step, unit: unit === 's' ? ' s' : ' px', dec: unit === 's' ? 1 : 0, vars: true }),
    h('button', { class: 'reset', title: 'Valeur du thème de base', html: icon('replay'), onclick: () => { delete p.vars[k]; changed('css', { commit: 'now', vars: true }); setTimeout(refreshFields, 150); } })))));
  const fonts = h('div', { class: 'chips' }, ...p.fonts.map(f => h('span', { class: 'chip' }, f.family)));
  insp.append(sec('Police principale', 'text',
    row('Police', selectField(fontOptions('Police du thème'), () => p.font || '', v => fontSetter(v, f => { p.font = f || null; changed('css', { commit: 'now' }); }))),
    p.fonts.length ? note('Polices importées :') : null, p.fonts.length ? fonts : null,
    h('div', { class: 'btns', style: 'margin-top:10px' }, btn('Importer une police', 'upload', () => importFont().then(() => renderInspector())))));
  const t = p.transitions;
  insp.append(sec('Transitions REPLAY / LIVE', 'video',
    wipeToggle('replay'), wipeToggle('live'),
    note('Décoche pour faire <b>ta propre animation</b> en calques (<b>Afficher pendant : Anim. REPLAY / Anim. LIVE</b>) sans qu\'elle se superpose à celle de base : le moment se déclenche toujours au même instant. Pour une vidéo plus longue que le moment, active <b>Lire jusqu\'au bout</b> sur le calque vidéo.'),
    note('Ou remplace-les directement par tes vidéos (WebM avec transparence conseillé) :'),
    t.hideReplay ? null : fileRow('REPLAY', () => t.replay, id => { t.replay = id; }, '.webm,.mp4,.mov', { removable: true, level: 'all', empty: 'Animation du thème' }),
    t.hideLive ? null : fileRow('LIVE (retour au direct)', () => t.live, id => { t.live = id; }, '.webm,.mp4,.mov', { removable: true, level: 'all', empty: 'Animation du thème' }),
    (t.replay || t.live) ? h('div', { class: 'grid2' },
      num('Coupe', () => t.replayCut ?? '', v => { t.replayCut = Math.max(0, Math.round(v)); }, { unit: 'ms', dec: 0, level: 'all', step: 10 }),
      num('Coupe', () => t.liveCut ?? '', v => { t.liveCut = Math.max(0, Math.round(v)); }, { unit: 'ms', dec: 0, level: 'all', step: 10 })) : null,
    (t.replay || t.live) ? note('Coupe : moment où l\'image change sous la vidéo (vide = à mi-vidéo). Gauche = REPLAY, droite = LIVE.') : null,
    h('div', { class: 'btns', style: 'margin-top:4px' }, btn('Tester', 'play', () => playTest('goal')))));
  insp.append(sec('Écran de fin', 'flag',
    fileRow('Fond (image ou vidéo)', () => p.endBg, id => { p.endBg = id; }, '.png,.jpg,.jpeg,.webp,.gif,.webm,.mp4', { removable: true, level: 'all', empty: 'Fond du thème' })));
  insp.append(sec('Animations importées', 'sparkle',
    note('Importe un fichier .css contenant des <b>@keyframes</b> (par ex. depuis Animista ou Animate.css) : elles apparaissent dans les listes d\'animations des calques.'),
    p.importedAnims.length ? h('div', { class: 'chips', style: 'margin-bottom:10px' }, ...p.importedAnims.map(n => h('span', { class: 'chip' }, n))) : null,
    h('div', { class: 'btns' }, btn('Importer un .css', 'upload', () => importAnimCss()),
      p.importedAnims.length ? btn('Tout retirer', 'trash', () => { p.importedAnims = []; p.importedCss = ''; changed('css', { commit: 'now', inspector: true }); }, 'danger') : null)));
  insp.append(sec('CSS avancé', 'sliders',
    note('Ajouté à la fin du thème. Écris <b>:theme</b> pour cibler ce thème, ex. <b>:theme #timer { color: gold; }</b>'),
    textInput(() => p.customCss, v => { p.customCss = v; }, { area: true, code: true, placeholder: ':theme #scoreboard {\n  border-radius: 12px;\n}' })));
}

async function importFont(file) {
  if (!file) file = await pickFile(ACCEPT.font);
  if (!file) return null;
  busy(true, 'Import de la police…');
  try {
    const id = await uploadBlob(file, file.name);
    let fam = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+(regular|bold|black|italic|medium|semibold|light)$/i, '').trim().slice(0, 40) || 'Police';
    if (!S.p.fonts.some(f => f.family === fam)) S.p.fonts.push({ family: fam, asset: id });
    busy(false);
    loadEditorFonts();
    changed('css', { commit: 'now' });
    toast(`Police « ${fam} » importée`, 'ok');
    return fam;
  } catch (e) { busy(false); toast(e.message, 'err'); return null; }
}
async function importAnimCss(file) {
  if (!file) file = await pickFile('.css');
  if (!file) return;
  const css = await file.text();
  const names = [...css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)].map(m => m[1]);
  const kfs = [];
  const re = /@(?:-webkit-)?keyframes\s+[\w-]+\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 0, i = m.index + m[0].length - 1;
    for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') { depth--; if (!depth) break; } }
    kfs.push(css.slice(m.index, i + 1));
  }
  if (!names.length) { toast('Aucune animation (@keyframes) trouvée dans ce fichier', 'err'); return; }
  const fresh = [...new Set(names)].filter(n => !S.p.importedAnims.includes(n));
  S.p.importedAnims.push(...fresh);
  S.p.importedCss = (S.p.importedCss ? S.p.importedCss + '\n' : '') + kfs.join('\n');
  changed('css', { commit: 'now', inspector: true });
  toast(`${fresh.length} animation${fresh.length > 1 ? 's' : ''} importée${fresh.length > 1 ? 's' : ''}`, 'ok');
}
function loadEditorFonts() {
  /* aperçu des polices dans l'éditeur (listes) */
  const css = S.p.fonts.map(f => fileOf(f.asset) ? `@font-face{font-family:'${f.family}';src:url('/studio-work/${fileOf(f.asset)}')}` : '').join('');
  let st = $('#editor-fonts');
  if (!st) { st = document.createElement('style'); st.id = 'editor-fonts'; document.head.append(st); }
  st.textContent = css;
}

/* ─────────────────────────── Tester, rejouer ─────────────────────────── */
let testT = 0;
function playTest(kind) {
  const f = F();
  if (!f) return;
  clearTimeout(testT);
  setScene('game', true);
  setTimeout(() => {
    frame.contentWindow.postMessage({ type: 'preview-' + kind, team: S.pvWin || 0 }, '*');
    toast(kind === 'goal' ? 'But → replay → retour au direct (≈ 16 s)' : kind === 'end' ? 'Écran de fin (7 s)' : 'Victoire de la série (5 s)');
  }, 250);
  const back = S.scene;
  testT = setTimeout(() => setScene(back, true), kind === 'goal' ? 17000 : kind === 'end' ? 7800 : 5800);
}
function replayLayer(id) { const f = F(); if (f) f.replay(id); }

/* ─────────────────────────── Fichiers : projet, thème, image ─────────────────────────── */
function usedAssets() {
  const p = S.p, ids = new Set();
  p.layers.forEach(L => L.asset && ids.add(L.asset));
  p.fonts.forEach(f => f.asset && ids.add(f.asset));
  ['replay', 'live'].forEach(k => p.transitions[k] && ids.add(p.transitions[k]));
  if (p.endBg) ids.add(p.endBg);
  if (p.end && p.end.mvp && p.end.mvp.img) ids.add(p.end.mvp.img);
  return [...ids].filter(id => p.assets[id]);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const blobToB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(b); });
function b64ToBlob(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u]); }

/* Projet autonome : JSON + fichiers intégrés en base64 (un seul fichier .rlstudio à partager) */
async function projectBlob() {
  commitNow();
  const p = clone(S.p), keep = new Set(usedAssets());
  for (const [id, a] of Object.entries(p.assets)) {
    if (!keep.has(id)) { delete p.assets[id]; continue; }
    const r = await fetch('/studio-work/' + a.file);
    if (!r.ok) throw new Error(`Fichier introuvable : ${a.name}`);
    a.data = await blobToB64(await r.blob());
  }
  return new Blob([JSON.stringify(p)], { type: 'application/json' });
}
/* Ctrl+S : réécrit le fichier ouvert · Ctrl+Maj+S (ou pas encore de fichier) : choisir où l'enregistrer */
async function saveProject(saveAs) {
  busy(true, 'Enregistrement du projet…');
  try {
    const blob = await projectBlob();
    const api = window.electronAPI;
    if (api && api.studioSave) {
      const r = await api.studioSave({ file: saveAs ? null : S.filePath, data: await blob.text(), suggested: slug(S.p.name) || 'projet' });
      if (!r || r.canceled) { busy(false); return; }
      markSaved(r.file);
      toast(`Enregistré — ${baseName(r.file)}`, 'ok');
    } else {
      download(blob, `${slug(S.p.name) || 'projet'}.rlstudio`);
      markSaved();
      toast('Projet enregistré (.rlstudio)', 'ok');
    }
  } catch (e) { toast(e.message || 'Enregistrement impossible', 'err'); }
  busy(false);
}
/* filePath : fichier .rlstudio à rouvrir directement (projets récents, sans boîte de dialogue) */
async function openProjectFile(file, filePath) {
  const api = window.electronAPI;
  let text = null, path = null;
  if (filePath && api && api.studioOpen) {
    try { const r = await api.studioOpen({ file: filePath }); text = r.data; path = r.file; }
    catch (e) { toast(`Fichier introuvable : ${baseName(filePath)}`, 'err'); return; }
  } else if (!file && api && api.studioOpen) {
    const r = await api.studioOpen({});
    if (!r || r.canceled) return;
    text = r.data; path = r.file;
  } else {
    if (!file) file = await pickFile('.rlstudio,.json');
    if (!file) return;
  }
  busy(true, 'Ouverture du projet…');
  try {
    const j = JSON.parse(text != null ? text : await file.text());
    if (j.format !== 'rlo-studio') throw new Error('Ce fichier n\'est pas un projet du Studio');
    for (const [id, a] of Object.entries(j.assets || {})) {
      if (!a.data) continue;
      const nid = await uploadBlob(b64ToBlob(a.data), a.name || a.file);
      delete a.data;
      if (nid !== id) { j.assets[nid] = { ...S.p.assets[nid] }; delete j.assets[id]; }
    }
    loadProject(j, { file: path });
    toast(`Projet « ${j.name} » ouvert`, 'ok');
  } catch (e) { toast(e.message || 'Projet illisible', 'err'); }
  busy(false);
}
/* opts.file : fichier .rlstudio d'origine (Ctrl+S y réécrira) · opts.dirty : restauré avec des modifs non enregistrées */
function loadProject(p, opts = {}) {
  S.p = normalize(p);
  setSel(null);
  $('#proj-name').value = S.p.name;
  resetHistory();
  loadEditorFonts();
  loadBase(S.p.base);
  schedule('all'); schedule('layers');
  renderAll();
  S.filePath = opts.file || null;
  if (opts.dirty) { S.savedSnap = null; S.dirty = true; autosave(); }
  else markSaved();
}
function newProjectCmd() {
  confirmBox('Nouveau projet', 'Le projet actuel sera remplacé. Pense à l\'enregistrer si tu veux le garder.', 'Nouveau projet', () => {
    loadProject(newProject());
    setTab('theme');
  });
}

function buildMeta() {
  const bm = S.base.meta || {}, m = {};
  for (const k of ['wipeVideos', 'endBackground', 'timerFormat', 'wipeText', 'alias']) if (bm[k] != null) m[k] = clone(bm[k]);
  if (S.p.base && S.p.base !== 'rlcs') m.basedOn = S.p.base;
  const t = S.p.transitions;
  if (fileOf(t.replay) || fileOf(t.live)) {
    m.wipeVideos = { ...(bm.wipeVideos || {}) };
    if (fileOf(t.replay)) m.wipeVideos.replay = fileOf(t.replay);
    if (fileOf(t.live)) m.wipeVideos.live = fileOf(t.live);
    ['replayCut', 'liveCut', 'replayDelay', 'liveDelay'].forEach(k => { if (t[k] !== '' && t[k] != null) m.wipeVideos[k] = Number(t[k]); });
  }
  if (fileOf(S.p.endBg)) m.endBackground = fileOf(S.p.endBg);
  if (S.p.options.timerShort) m.timerFormat = 'm:ss';
  const go = goalRuntimeOpts();
  if (go) m.goal = go;
  const eo = endRuntimeOpts(), wo = winRuntimeOpts();
  if (eo) m.end = eo;
  if (wo) m.win = wo;
  const bo = bmtRuntimeOpts();
  if (bo) m.boostMeter = bo;
  m.layers = layerSpecs(installCtx);
  m.studio = { version: 1, project: S.p.id };
  return m;
}
function themePayload(mode, extra = {}) {
  commitNow();
  const pb = processBaseCss(S.base.css, '__THEME__', '__THEME__', S.p.base);
  const st = buildStudioCss(installCtx);
  const imports = [...new Set([...pb.imports, ...st.imports])];
  const name = String(S.p.name || 'Mon thème').replace(/\*\//g, '');
  const css = `/* Thème « ${name} » — créé avec le Studio de RL Overlay. Pour le modifier : Studio → Fichier → Modifier un thème du Studio. */\n${imports.join('\n')}\n${pb.css}\n\n/* ═══════════ Studio ═══════════ */\n${st.css}\n`;
  const project = clone(S.p);
  for (const id of Object.keys(project.assets)) if (!usedAssets().includes(id)) delete project.assets[id];
  return { mode, name: S.p.name, themeId: S.p.themeId || slug(S.p.name), base: S.p.base, css, meta: buildMeta(), project, assets: usedAssets().map(fileOf).filter(Boolean), ...extra };
}
function installDialog() {
  const p = S.p;
  let name = p.name, apply = true;
  modal({
    title: 'Installer le thème', icon: 'check',
    body: [
      row('Nom du thème', h('input', { class: 'in', value: name, maxlength: 40, oninput: e => { name = e.target.value; } })),
      row('Appliquer', h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: true, onchange: e => { apply = e.target.checked; } }), h('span'))),
      note(p.themeId ? `Le thème déjà installé (<b>${esc(p.themeId)}</b>) sera mis à jour.` : 'Le thème apparaîtra dans le panneau de contrôle, carte <b>Thème</b> → Thèmes importés.'),
    ],
    ok: 'Installer', onOk: async () => {
      p.name = name.trim() || p.name; $('#proj-name').value = p.name;
      busy(true, 'Installation du thème…');
      try {
        const r = await fetch('/api/studio/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(themePayload('install', { apply })) });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error || 'Installation impossible');
        p.themeId = j.id; commit();
        toast(`Thème « ${p.name} » ${j.updated ? 'mis à jour' : 'installé'}${j.applied ? ' et appliqué' : ''} ✓`, 'ok');
      } catch (e) { toast(e.message, 'err'); }
      busy(false);
    },
  });
}
async function exportZip() {
  busy(true, 'Création du ZIP…');
  try {
    const r = await fetch('/api/studio/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(themePayload('zip')) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Export impossible');
    download(await r.blob(), `${S.p.themeId || slug(S.p.name) || 'theme'}.zip`);
    toast('Thème exporté en .zip', 'ok');
  } catch (e) { toast(e.message, 'err'); }
  busy(false);
}
function pngDialog() {
  let bg = S.bg === 'checker' ? 'transparent' : S.bg, scene = S.scene;
  const seg = (opts, get, set) => { const s = h('div', { class: 'seg' }); opts.forEach(([v, l]) => { const b = h('button', { onclick: () => { set(v); $$('button', s).forEach(x => x.classList.toggle('on', x === b)); } }, l); if (get() === v) b.classList.add('on'); s.append(b); }); return s; };
  modal({
    title: 'Exporter en image', icon: 'camera',
    body: [
      note('Image PNG en 1920 × 1080, rendue avec l\'overlay réel.'),
      row('Fond', seg([['stadium', 'Stade'], ['transparent', 'Transparent'], ['green', 'Vert'], ['black', 'Noir']], () => bg, v => { bg = v; })),
      row('Scène', selectField(Object.entries(SCENES), () => scene, v => { scene = v; return false; })),
    ],
    ok: 'Exporter', onOk: async () => {
      busy(true, 'Rendu de l\'image…');
      try {
        const m = previewMedia();
        const payload = { base: S.p.base, baseCss: S.base.previewCss, studioCss: studioPreviewCss(), layers: layerSpecs(previewCtx), scene, bg, wipe: m.wipe, endBg: m.endBg, options: m.options, winner: S.pvWin || 0 };
        const r = await fetch('/api/studio/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Rendu impossible');
        download(await r.blob(), `${slug(S.p.name) || 'overlay'}-${scene}.png`);
        toast('Image exportée ✓', 'ok');
      } catch (e) { toast(e.message, 'err'); }
      busy(false);
    },
  });
}
/* ─── Récents et versions de secours ─── */
function fmtWhen(t) {
  const d = new Date(t), now = new Date(), min = Math.round((now - d) / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `aujourd'hui ${hm}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `hier ${hm}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${hm}`;
}
/* modifications non enregistrées : on prévient avant de remplacer le projet (elles restent dans les versions) */
function ifReplaceOk(fn) {
  if (!S.dirty) return fn();
  confirmBox('Remplacer le projet ouvert', 'Le projet ouvert a des modifications non enregistrées. Elles restent récupérables dans les versions de secours.', 'Continuer', fn);
}
async function recentDialog() {
  let recent = [], versions = [];
  try { recent = (await (await fetch('/api/studio/recent', { cache: 'no-store' })).json()).recent || []; } catch (e) {}
  try { versions = (await (await fetch('/api/studio/versions', { cache: 'no-store' })).json()).versions || []; } catch (e) {}
  const api = window.electronAPI, canOpen = !!(api && api.studioOpen);
  const curId = String(S.p.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  const item = (ic, title, sub, when, onclick, disabled) => h('button', { class: 'm-item', title: sub, disabled: !!disabled, onclick },
    h('i', { 'data-i': ic }), h('div', { class: 'm-txt' }, h('b', {}, title), h('small', {}, sub)), h('span', {}, when));
  const REASON = { replaced: ' · mis de côté à l\'ouverture d\'un autre projet', restore: ' · avant une restauration', manual: '' };
  modal({
    title: 'Récents et versions de secours', icon: 'clock', ok: null,
    body: [
      h('div', { class: 'm-sub' }, 'Projets récents'),
      recent.length && canOpen
        ? h('div', { class: 'm-list' }, ...recent.map(r => item('folder', r.name || baseName(r.file), r.exists ? r.file : `${r.file} — introuvable`, fmtWhen(r.at),
          () => { closeModal(); ifReplaceOk(() => openProjectFile(null, r.file)); }, !r.exists)))
        : note(canOpen ? 'Aucun projet enregistré pour l\'instant : <b>Ctrl+S</b> crée un fichier .rlstudio.' : 'Disponible dans l\'application.'),
      h('div', { class: 'm-sub' }, 'Versions de secours'),
      note('Le Studio garde une version toutes les 5 minutes de travail (10 par projet), et met l\'ancien projet de côté dès qu\'un autre le remplace. Restaurer ne supprime rien : le projet ouvert est d\'abord gardé en version.'),
      versions.length
        ? h('div', { class: 'm-list' }, ...versions.map(v => item('replay', v.name,
          `${v.layers} calque${v.layers > 1 ? 's' : ''}${v.projectId === curId ? ' · projet ouvert' : ''}${REASON[v.reason] || ''}`, fmtWhen(v.at),
          () => { closeModal(); restoreVersion(v); })))
        : note('Aucune version pour l\'instant.'),
    ],
  });
}
async function restoreVersion(v) {
  busy(true, 'Restauration de la version…');
  try {
    const j = await (await fetch('/api/studio/versions/' + encodeURIComponent(v.vid), { cache: 'no-store' })).json();
    if (!j.ok || !j.project) throw new Error(j.error || 'Version illisible');
    commitNow();
    /* même projet : on garde son état actuel en version (un autre projet est mis de côté tout seul par la sauvegarde auto) */
    if (j.project.id === S.p.id) await fetch('/api/studio/versions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: S.p, file: S.filePath || null, reason: 'restore' }) });
    loadProject(j.project, { file: j.file || null, dirty: true });
    toast(`« ${j.project.name || 'Projet'} » restauré (version ${fmtWhen(v.at)})`, 'ok');
  } catch (e) { toast(e.message || 'Restauration impossible', 'err'); }
  busy(false);
}

/* ─── Nettoyage des fichiers importés que plus rien n'utilise (studio-work) ─── */
const fmtSize = b => b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`;
function keepFiles() {
  const s = new Set();
  for (const t of [JSON.stringify(S.p), ...HIST.stack]) for (const m of t.match(/[a-f0-9]{20}\.[a-z0-9]{2,5}/g) || []) s.add(m);
  return [...s];
}
async function cleanupDialog() {
  const call = dry => fetch('/api/studio/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keep: keepFiles(), dry }) }).then(r => r.json());
  busy(true, 'Analyse des fichiers…');
  let r = null;
  try { r = await call(true); } catch (e) {}
  busy(false);
  if (!r || !r.ok) return toast('Analyse impossible', 'err');
  const kept = note('Gardés : le projet ouvert et son historique (annuler / rétablir), la sauvegarde auto et les versions de secours. Les thèmes installés et tes fichiers .rlstudio ont leur propre copie des fichiers : ils ne sont pas touchés.');
  if (!r.count) return modal({ title: 'Nettoyer les fichiers inutilisés', icon: 'trash', ok: null, body: [h('div', {}, `Rien à nettoyer : les ${r.kept} fichiers importés sont tous utilisés.`), kept] });
  const pl = r.count > 1 ? 's' : '';
  modal({
    title: 'Nettoyer les fichiers inutilisés', icon: 'trash', ok: `Supprimer ${r.count} fichier${pl}`,
    body: [h('div', { html: `<b>${r.count}</b> fichier${pl} importé${pl} (<b>${fmtSize(r.bytes)}</b>) ${r.count > 1 ? 'ne sont' : 'n\'est'} plus utilisé${pl} par aucun projet.` }), kept],
    onOk: async () => {
      busy(true, 'Nettoyage…');
      try { const x = await call(false); toast(`${x.count} fichier${x.count > 1 ? 's' : ''} supprimé${x.count > 1 ? 's' : ''} — ${fmtSize(x.bytes)} libérés`, 'ok'); }
      catch (e) { toast('Nettoyage impossible', 'err'); }
      busy(false);
    },
  });
}

/* Importer un thème .zip : un ZIP du Studio se rouvre en projet complet ; tout autre thème est installé
   puis sert de « Basé sur » à un nouveau projet (sa mise en page et ses animations, personnalisables par-dessus) */
async function importZip(file) {
  if (!file) file = await pickFile('.zip');
  if (!file) return;
  const run = async () => {
    busy(true, 'Import du thème…');
    try {
      const fd = new FormData();
      fd.append('zip', file);
      fd.append('filename', file.name);
      const r = await fetch('/api/studio/import-zip', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Import impossible');
      await applyImported(j, file.name);
    } catch (e) { toast(e.message || 'Import impossible', 'err'); }
    busy(false);
  };
  ifReplaceOk(run);
}
/* Résultat d'un import (ZIP ou code de partage) : projet du Studio rouvert, ou nouveau projet basé sur le thème installé */
async function applyImported(j, fileName, from) {
  await loadThemes();
  if (j.kind === 'project') {
    loadProject(j.project, { dirty: true });
    toast(`Projet « ${j.project.name || 'sans nom'} »${from ? ` de ${from}` : ''} ouvert${j.missing ? ` — ${j.missing} fichier${j.missing > 1 ? 's' : ''} manquant${j.missing > 1 ? 's' : ''}` : ''}`, j.missing ? 'err' : 'ok');
    if (j.missingBase) setTimeout(() => toast(`Ce thème est basé sur « ${j.missingBase} », qui n'est pas installé ici : installe-le pour le voir comme prévu`, 'err'), 2600);
  } else {
    const p = newProject();
    p.base = j.id;
    p.name = String(fileName || '').replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Mon thème';
    loadProject(p, { dirty: true });
    setTab('theme');
    toast(`Thème « ${j.id} » ${j.reused ? 'déjà installé' : 'installé'} : nouveau projet basé dessus`, 'ok');
  }
}

/* ─── Partage par code (compte du site, via la licence de l'app) ─── */
function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => toast(`Code ${code} copié`, 'ok'), () => toast('Copie impossible : sélectionne le code', 'err'));
}
async function shareDialog() {
  const list = h('div', { class: 'm-list' }, note('Chargement de tes partages…'));
  const render = async () => {
    let r;
    try { r = await (await fetch('/api/studio/shares', { cache: 'no-store' })).json(); } catch (e) { r = { error: 'Site injoignable' }; }
    list.innerHTML = '';
    if (!r.ok) { list.append(note(esc(r.error || 'Impossible de lire tes partages'))); return; }
    if (!r.shares.length) { list.append(note('Aucun projet partagé pour l\'instant.')); return; }
    for (const s of r.shares) {
      const del = btn('', 'trash', async () => {
        del.disabled = true;
        const x = await (await fetch('/api/studio/shares/' + s.code, { method: 'DELETE' })).json().catch(() => ({}));
        toast(x.ok ? `Partage ${s.code} supprimé` : (x.error || 'Suppression impossible'), x.ok ? 'ok' : 'err');
        render();
      });
      del.title = 'Supprimer ce partage (le code ne marchera plus)';
      const cp = btn('', 'copy', () => copyCode(s.code));
      cp.title = 'Copier le code';
      list.append(h('div', { class: 'm-item share' },
        h('div', { class: 'm-txt' }, h('b', {}, s.name), h('small', {}, `${fmtSize(s.size)} · ${s.downloads} ouverture${s.downloads > 1 ? 's' : ''} · expire le ${new Date(s.expiresAt).toLocaleDateString('fr-FR')}`)),
        h('code', { class: 'share-code' }, s.code), cp, del));
    }
    hydrateIcons(list);
  };
  modal({
    title: 'Partager le projet par code', icon: 'upload', ok: 'Créer un code pour ce projet', onOk: createShare,
    body: [
      h('div', { html: `Envoie <b>« ${esc(S.p.name || 'Mon thème')} »</b> sur ton compte overlay.rscast.fr : tu reçois un <b>code</b> à donner à qui tu veux. Il l'ouvre dans son Studio avec <b>Fichier → Ouvrir un projet partagé</b>, avec tous les fichiers.` }),
      note('Code valable 30 jours · 80 Mo maximum · 10 partages par compte (au-delà, le plus ancien est remplacé). Tes partages apparaissent aussi dans ton profil sur le site.'),
      h('div', { class: 'm-sub' }, 'Mes partages'), list,
    ],
  });
  render();
}
async function createShare() {
  busy(true, 'Envoi du projet sur le site…');
  try {
    const r = await fetch('/api/studio/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(themePayload('zip')) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Partage impossible');
    busy(false);
    const s = j.share;
    modal({
      title: 'Projet partagé', icon: 'check', ok: 'Copier le code', onOk: () => copyCode(s.code),
      body: [
        h('div', { class: 'share-big' }, s.code),
        h('div', { html: `Donne ce code : dans le Studio, <b>Fichier → Ouvrir un projet partagé</b>. Valable jusqu'au <b>${new Date(s.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b> (${fmtSize(s.size)}).` }),
        j.replaced ? note(`Tu avais déjà ${j.max} partages : le plus ancien (${j.replaced}) a été remplacé.`) : null,
      ],
    });
  } catch (e) { busy(false); toast(e.message || 'Partage impossible', 'err'); }
}
function shareOpenDialog() {
  const inp = h('input', { class: 'in share-input', maxlength: 12, placeholder: 'CODE', spellcheck: 'false', autocomplete: 'off' });
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { closeModal(); openShared(inp.value); } });
  modal({
    title: 'Ouvrir un projet partagé', icon: 'download', ok: 'Ouvrir', onOk: () => openShared(inp.value),
    body: [h('div', {}, 'Entre le code reçu :'), inp, note('Le projet s\'ouvre avec tous ses fichiers, prêt à être modifié. Pas besoin de compte pour ouvrir un code.')],
  });
}
function openShared(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) return toast('Code invalide', 'err');
  ifReplaceOk(async () => {
    busy(true, 'Téléchargement du projet…');
    try {
      const r = await fetch('/api/studio/share-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Ouverture impossible');
      await applyImported(j, `${(j.share && j.share.name) || code}.zip`, j.share && j.share.username);
    } catch (e) { toast(e.message || 'Ouverture impossible', 'err'); }
    busy(false);
  });
}

async function openThemeDialog() {
  await loadThemes();
  const list = S.themes.filter(t => t.studio);
  modal({
    title: 'Modifier un thème du Studio', icon: 'layers',
    body: [
      list.length ? h('div', { class: 'm-list' }, ...list.map(t => h('button', { class: 'm-item', onclick: async () => {
        closeModal(); busy(true, 'Ouverture du thème…');
        try { const r = await fetch('/api/studio/project/' + encodeURIComponent(t.id)); const j = await r.json(); if (!j.ok) throw new Error(j.error); loadProject(j.project); toast(`« ${t.label || t.name || t.id} » ouvert`, 'ok'); }
        catch (e) { toast(e.message || 'Ouverture impossible', 'err'); }
        busy(false);
      }, html: `${icon('palette')}<b>${esc(t.label || t.name || t.id)}</b><span>${esc(t.id)}</span>` })))
        : note('Aucun thème créé avec le Studio n\'est installé pour le moment. Pour partir d\'un thème existant, choisis-le dans <b>Thème → Basé sur</b>.'),
    ],
    ok: null,
  });
}
function submitDialog() {
  modal({
    title: 'Proposer sur le site', icon: 'upload',
    body: [h('div', { class: 'm-body', style: 'padding:0', html: `Pour partager ton thème avec tout le monde :<br><br>
      <b>1.</b> Exporte-le en <b>.zip</b> (bouton ci-dessous).<br>
      <b>2.</b> Sur le site, page <b>Thèmes → Proposer un thème</b> : crée ton thème, puis clique <b>📦 ZIP du Studio</b> et choisis le ZIP. Le theme.css, le meta.json, le projet (studio.json) et tous les fichiers sont remplis d'un coup. Ajoute une image de prévisualisation.<br>
      <b>3.</b> Après validation, il apparaît dans la bibliothèque de l'app et sur le Discord. Ceux qui le téléchargent peuvent le rouvrir dans leur Studio (Fichier → Modifier un thème du Studio).` })],
    ok: 'Exporter le ZIP et ouvrir le site', onOk: async () => {
      await exportZip();
      const url = 'https://overlay.rscast.fr/themes/submit';
      if (window.electronAPI && window.electronAPI.openUrl) window.electronAPI.openUrl(url); else window.open(url, '_blank');
    },
  });
}

/* ─────────────────────────── Fenêtres, menus, notifications ─────────────────────────── */
function modal({ title, icon: ic, body, ok = 'OK', onOk, cancel = 'Annuler' }) {
  S.fields = S.fields || [];
  const m = $('#modal');
  m.innerHTML = '';
  m.append(h('div', { class: 'm-head', html: (ic ? icon(ic) : '') + esc(title) }));
  m.append(h('div', { class: 'm-body' }, ...[].concat(body || [])));
  const foot = h('div', { class: 'm-foot' });
  foot.append(h('button', { class: 'btn', onclick: closeModal }, ok ? cancel : 'Fermer'));
  if (ok) foot.append(h('button', { class: 'btn primary', onclick: () => { closeModal(); onOk && onOk(); } }, ok));
  m.append(foot);
  hydrateIcons(m);
  $('#modal-bg').classList.add('open');
  const first = m.querySelector('input.in');
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() { $('#modal-bg').classList.remove('open'); }
$('#modal-bg').addEventListener('pointerdown', e => { if (e.target.id === 'modal-bg') closeModal(); });
function confirmBox(title, text, ok, fn) { modal({ title, icon: 'info', body: [h('div', { html: esc(text) })], ok, onOk: fn }); }
let toastT = 0;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.className = 'show ' + kind;
  t.innerHTML = (kind === 'ok' ? icon('check') : kind === 'err' ? icon('info') : '') + esc(msg);
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = kind; }, kind === 'err' ? 4500 : 2800);
}
let busyEl = null;
function busy(on, text) {
  if (on) { if (!busyEl) { busyEl = h('div', { class: 'busy-ov' }, h('div', { class: 'spin' }), h('span')); document.body.append(busyEl); } busyEl.querySelector('span').textContent = text || 'Patiente…'; }
  else if (busyEl) { busyEl.remove(); busyEl = null; }
}
function closeMenus() { $$('.menu.open').forEach(m => m.classList.remove('open')); }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenus(); });
$$('[data-menu]').forEach(b => b.addEventListener('click', () => { const m = $('#menu-' + b.dataset.menu); const o = m.classList.contains('open'); closeMenus(); if (!o) m.classList.add('open'); }));

function openCtx(x, y) {
  const m = $('#ctx-menu');
  const s = S.sel;
  if (!s) return;
  if (isMulti()) {
    const hasLayers = selList().some(x => x.kind !== 'el');
    const hasPlain = selList().some(x => x.kind === 'layer');
    const multiItems = [
      hasLayers ? ['folderPlus', 'Grouper dans un nouveau dossier', 'Ctrl+G', groupSelection] : null,
      ...(hasPlain ? S.p.layers.filter(isGroup).slice(0, 8).map(g => ['folder', `Ranger dans « ${g.name} »`, '', () => moveSelectionIntoGroup(g.id)]) : []),
      hasLayers ? ['copy', 'Dupliquer', 'Ctrl+D', duplicateSelected] : null,
      ['aC', 'Centrer horizontalement', '', () => alignMulti('c')],
      ['aM', 'Centrer verticalement', '', () => alignMulti('m')],
      '-',
      ['lock', 'Verrouiller', '', () => setFlag('locked', true)],
      ['eyeoff', 'Masquer', '', () => setFlag('hidden', true)],
      '-',
      ['trash', `Supprimer (${selList().length})`, 'Suppr', deleteSelection, 'danger'],
    ].filter(Boolean);
    m.innerHTML = '';
    for (const it of multiItems) {
      if (it === '-') { m.append(h('div', { class: 'sep' })); continue; }
      const [ic, l, k, fn, cls] = it;
      m.append(h('button', { class: cls || '', html: `${icon(ic)}${esc(l)}${k ? `<kbd>${k}</kbd>` : ''}`, onclick: () => { closeMenus(); fn(); } }));
    }
    m.classList.add('open');
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
    return;
  }
  const isG = s.kind === 'group', isL = s.kind === 'layer' || isG, obj = isL ? layerById(s.id) : elData(s.id);
  const items = [
    ['text', 'Renommer', 'F2', () => startRename(s)],
    isL ? ['copy', isG ? 'Dupliquer le dossier' : 'Dupliquer', 'Ctrl+D', () => duplicateLayer(s.id)] : null,
    s.kind === 'layer' ? ['folderPlus', 'Ranger dans un nouveau dossier', 'Ctrl+G', groupSelection] : null,
    ...(s.kind === 'layer' ? S.p.layers.filter(g => isGroup(g) && g.id !== obj.group).slice(0, 8).map(g => ['folder', `Ranger dans « ${g.name} »`, '', () => moveSelectionIntoGroup(g.id)]) : []),
    s.kind === 'layer' && obj.group ? ['folderOpen', 'Sortir du dossier', '', () => leaveGroup(s.id)] : null,
    isG ? ['folderOpen', 'Dissocier le dossier', 'Ctrl+Maj+G', () => ungroup(s.id)] : null,
    ['aC', 'Centrer horizontalement', '', () => alignSel('c')],
    ['aM', 'Centrer verticalement', '', () => alignSel('m')],
    '-',
    isL ? ['layers', 'Premier plan', '', () => moveLayer(s.id, 'top')] : null,
    isL ? ['layers', 'Arrière-plan', '', () => moveLayer(s.id, 'bottom')] : null,
    [obj.locked ? 'unlock' : 'lock', obj.locked ? 'Déverrouiller' : 'Verrouiller', '', () => { obj.locked = !obj.locked; if (!obj.locked) delete obj.locked; changed('css', { layers: true, commit: 'now' }); }],
    !isL ? ['replay', 'Réinitialiser la position', '', () => { delete obj.x; delete obj.y; delete obj.s; delete obj.r; changed('css', { commit: 'now', layers: true }); }] : null,
    '-',
    isL ? ['trash', isG ? 'Supprimer le dossier et son contenu' : 'Supprimer', 'Suppr', deleteSelection, 'danger'] : ['eyeoff', 'Masquer', 'Suppr', deleteSelection],
  ].filter(Boolean);
  m.innerHTML = '';
  for (const it of items) {
    if (it === '-') { m.append(h('div', { class: 'sep' })); continue; }
    const [ic, l, k, fn, cls] = it;
    m.append(h('button', { class: cls || '', html: `${icon(ic)}${esc(l)}${k ? `<kbd>${k}</kbd>` : ''}`, onclick: () => { closeMenus(); fn(); } }));
  }
  m.classList.add('open');
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}
ui.addEventListener('contextmenu', e => {
  e.preventDefault();
  const it = hitTest(toCanvas(e.clientX, e.clientY));
  if (it) { if (!isSelected(it)) select({ kind: it.kind, id: it.id }); openCtx(e.clientX, e.clientY); }
});

/* ─────────────────────────── Commandes & raccourcis ─────────────────────────── */
const ACTIONS = {
  new: newProjectCmd, open: () => openProjectFile(), save: () => saveProject(false), 'save-as': () => saveProject(true), 'open-theme': openThemeDialog,
  'import-zip': () => importZip(), recent: recentDialog, cleanup: cleanupDialog, share: shareDialog, 'share-open': shareOpenDialog,
  'new-group': groupSelection,
  'export-zip': exportZip, 'export-png': pngDialog, 'submit-site': submitDialog, install: installDialog,
  undo, redo,
  'zoom-in': () => zoomStep(1), 'zoom-out': () => zoomStep(-1), 'zoom-fit': fit, 'zoom-100': () => zoomAt(1),
  'play-goal': () => playTest('goal'), 'play-end': () => playTest('end'), 'play-win': () => playTest('win'), 'play-layers': () => replayLayer(null),
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && ACTIONS[b.dataset.act]) { closeMenus(); ACTIONS[b.dataset.act](); }
  const add = e.target.closest('[data-add]');
  if (add) addLayer(add.dataset.add);
  const sc = e.target.closest('[data-scene]');
  if (sc) setScene(sc.dataset.scene);
  const tg = e.target.closest('[data-toggle]');
  if (tg) { const k = tg.dataset.toggle; S[k] = !S[k]; tg.classList.toggle('on', S[k]); savePrefs(); if (k === 'rulers') { const r0 = stageRect(); setTimeout(() => { const r1 = stageRect(); S.panX += r0.left - r1.left; S.panY += r0.top - r1.top; applyView(); }, 0); } applyView(); }
  const bgb = e.target.closest('[data-bg]');
  if (bgb) { S.bg = bgb.dataset.bg; $$('#bg-seg button').forEach(x => x.classList.toggle('on', x === bgb)); const f = F(); if (f) f.setBg(S.bg); savePrefs(); }
  const tab = e.target.closest('[data-tab]');
  if (tab) setTab(tab.dataset.tab);
});
$('#proj-name').addEventListener('input', e => { S.p.name = e.target.value; commitSoon(); });
$('#proj-name').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });

document.addEventListener('keydown', e => {
  if (e.key === ' ' && !isInput(document.activeElement)) { if (!S.space) { S.space = true; vp.classList.add('space-down'); } e.preventDefault(); return; }
  if (isInput(document.activeElement)) return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.key === 'Escape') { closeMenus(); closeModal(); if (S.sels.length) select(null); return; }
  if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (ctrl && k === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
  if (ctrl && k === 'o') { e.preventDefault(); if (e.shiftKey) recentDialog(); else openProjectFile(); return; }
  if (ctrl && k === 'n') { e.preventDefault(); newProjectCmd(); return; }
  if (ctrl && k === 'e') { e.preventDefault(); pngDialog(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); if (isMulti()) duplicateSelected(); else if (S.sel && S.sel.kind !== 'el') duplicateLayer(S.sel.id); return; }
  if (ctrl && k === 'a') { e.preventDefault(); selectAll(); return; }
  if (e.key === 'F2') { e.preventDefault(); if (S.sel && !isMulti()) startRename(S.sel); return; }
  if (ctrl && k === 'g') {
    e.preventDefault();
    if (e.shiftKey) { const x = S.sel && layerById(S.sel.id); const gid = x && (isGroup(x) ? x.id : x.group); if (gid) ungroup(gid); }
    else groupSelection();
    return;
  }
  if (ctrl && k === 'c') { copySelection(); return; }
  if (ctrl && k === 'v') { pasteClip(); return; }
  if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); zoomStep(1); return; }
  if (ctrl && k === '-') { e.preventDefault(); zoomStep(-1); return; }
  if (ctrl && k === '0') { e.preventDefault(); fit(); return; }
  if (ctrl && k === '1') { e.preventDefault(); zoomAt(1); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  const step = e.shiftKey ? 10 : 1;
  if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0); }
  if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step, 0); }
  if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -step); }
  if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, step); }
});
document.addEventListener('keyup', e => { if (e.key === ' ') { S.space = false; vp.classList.remove('space-down'); } });
window.addEventListener('blur', () => { S.space = false; vp.classList.remove('space-down'); });

/* ─────────────────────────── Démarrage ─────────────────────────── */
function renderAll() {
  $$('#scenes button').forEach(b => b.classList.toggle('on', b.dataset.scene === S.scene));
  renderLayers(); renderInspector(); applyView();
}
async function loadThemes() {
  try { const r = await fetch('/api/studio/themes'); const j = await r.json(); S.themes = j.themes || []; } catch (e) { S.themes = []; }
}
function onFrameReady() {
  if (S.frameOk) return;
  if (!F()) { setTimeout(onFrameReady, 80); return; }
  S.frameOk = true;
  const f = F();
  f.setBg(S.bg);
  schedule('all'); schedule('layers');
  setTimeout(() => { f.setScene(S.scene, { winner: S.pvWin || 0 }); forceOptional(); }, 400);
  setTimeout(() => { if (S.tab === 'theme') renderInspector(); }, 900);
}
frame.addEventListener('load', () => { S.frameOk = false; onFrameReady(); });
window.addEventListener('message', e => { if (e.data && e.data.type === 'studio-frame-ready') onFrameReady(); });

function loop() {
  if (S.frameOk) { measureAll(); if (S.sel && (S.sel.kind === 'el' || isMulti())) renderSel(); refreshHover(); }
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => { if (S.autoFit) fit(); else applyView(); });
/* Fermeture de la fenêtre : dernière sauvegarde automatique envoyée sans attendre la réponse */
window.addEventListener('beforeunload', () => {
  commitNow();
  try { localStorage.setItem('rlo-studio:project', JSON.stringify(S.p)); localStorage.setItem('rlo-studio:file', S.filePath || ''); } catch (e) {}
  try { navigator.sendBeacon('/api/studio/autosave', new Blob([autosaveBody()], { type: 'application/json' })); } catch (e) {}
});

(async function init() {
  hydrateIcons();
  try { Object.assign(S, JSON.parse(localStorage.getItem('rlo-studio:prefs') || '{}')); } catch (e) {}
  $$('[data-toggle]').forEach(b => b.classList.toggle('on', !!S[b.dataset.toggle]));
  $$('#bg-seg button').forEach(b => b.classList.toggle('on', b.dataset.bg === S.bg));
  $('#font-previews').href = googleUrl(FONTS.filter(f => !f.loaded).map(f => f.name));
  /* reprise : sauvegarde sur le disque de l'app, sinon celle du navigateur */
  let saved = null, file = null, dirty = false;
  try {
    const a = await (await fetch('/api/studio/autosave', { cache: 'no-store' })).json();
    if (a && a.project && a.project.format === 'rlo-studio') { saved = a.project; file = a.file || null; dirty = !!a.dirty; }
  } catch (e) {}
  if (!saved) {
    try { saved = JSON.parse(localStorage.getItem('rlo-studio:project') || 'null'); file = localStorage.getItem('rlo-studio:file') || null; dirty = true; } catch (e) {}
    if (saved && saved.format !== 'rlo-studio') saved = null;
  }
  S.p = normalize(saved || newProject());
  if (!saved) S.tab = 'theme';
  $('#proj-name').value = S.p.name;
  resetHistory();
  loadEditorFonts();
  await loadThemes();
  loadBase(S.p.base);
  renderAll();
  S.filePath = file;
  if (dirty) { S.savedSnap = null; S.dirty = true; updateFileLabel(); } else { S.savedSnap = JSON.stringify(S.p); S.dirty = false; updateFileLabel(); }
  requestAnimationFrame(() => { fit(); renderAll(); });
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') onFrameReady();
  loop();
  if (saved) toast(file ? `Projet repris — ${baseName(file)}` : 'Projet précédent repris');
  window.__studioEditor = { S, select, setScene, addLayer, loadProject, themePayload, fit, zoomAt, renderInspector, setTab, changed, undo, redo, commit,
    projectBlob, openProjectFile, importFont, importAnimCss, uploadBlob, playTest, newProject, groupSelection, ungroup, leaveGroup, moveLayer,
    previewMedia, studioPreviewCss, layerSpecs, previewCtx, importZip, recentDialog, restoreVersion, cleanupDialog, keepFiles, markSaved, shareDialog, createShare, shareOpenDialog, openShared };
})();
})();

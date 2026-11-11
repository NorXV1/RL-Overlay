/* ══════════════════════════════════════════════════════════════════════════════
   Studio RL Overlay — moteur des thèmes créés avec le Studio (chargé par global.html)

   Un thème du Studio = un thème normal (theme.css + meta.json) + des calques déclarés
   dans "layers" du meta.json : images, vidéos/GIF, textes (avec données en direct),
   formes et animations Lottie. Ce fichier crée ces calques dans l'overlay, les affiche
   selon leur déclencheur (toujours, en jeu, but, replay, fin de match, victoire,
   prolongation) et relance leurs animations à chaque déclenchement. Tout le style
   (position, taille, animations) vient du theme.css généré par le Studio.

   ?studio dans l'URL : mode éditeur — le Studio pilote l'aperçu via window.__studio.
══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const QS = new URLSearchParams(location.search);
  const IS_STUDIO = QS.has('studio');

  /* ── Animations prêtes à l'emploi (entrée sur .st-anim, boucle sur .st-loop) ── */
  const RUNTIME_CSS = `
#st-back, #st-front { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
#st-back { z-index:0; }
#st-front { z-index:9000; }
.st-layer { position:absolute; left:0; top:0; width:100px; height:100px; opacity:0; visibility:hidden;
  transition: opacity var(--st-out,.35s) ease, visibility 0s linear var(--st-out,.35s); }
.st-layer.st-on { opacity:var(--st-o,1); visibility:visible; transition: opacity .12s ease, visibility 0s; }
.st-layer[data-out="none"]:not(.st-on) { transition:none; }
.st-anim, .st-loop, .st-kf, .st-c { position:absolute; inset:0; }
.st-anim { transition: transform var(--st-out,.35s) ease-in, filter var(--st-out,.35s) ease-in, clip-path var(--st-out,.35s) ease-in; }
.st-layer:not(.st-on)[data-out="slide-left"]  > .st-anim { transform: translateX(-160px); }
.st-layer:not(.st-on)[data-out="slide-right"] > .st-anim { transform: translateX(160px); }
.st-layer:not(.st-on)[data-out="slide-up"]    > .st-anim { transform: translateY(-120px); }
.st-layer:not(.st-on)[data-out="slide-down"]  > .st-anim { transform: translateY(120px); }
.st-layer:not(.st-on)[data-out="zoom"]        > .st-anim { transform: scale(.55); }
.st-layer:not(.st-on)[data-out="blur"]        > .st-anim { filter: blur(16px); }
.st-layer:not(.st-on)[data-out="wipe"]        > .st-anim { clip-path: inset(0 0 0 100%); }
.st-c { overflow:visible; }
.st-c > img, .st-c > video { width:100%; height:100%; object-fit:contain; display:block; }
.st-c > img.st-teamlogo:not([src]) { visibility:hidden; }
.st-c > .st-lottie { width:100%; height:100%; }
.st-text { width:100%; height:100%; display:flex; align-items:center; justify-content:center; white-space:pre; line-height:1.1; }
.st-shape { width:100%; height:100%; }

@keyframes st-in-fade        { from { opacity:0; } }
@keyframes st-in-slide-left  { from { opacity:0; transform:translateX(-160px); } }
@keyframes st-in-slide-right { from { opacity:0; transform:translateX(160px); } }
@keyframes st-in-slide-up    { from { opacity:0; transform:translateY(120px); } }
@keyframes st-in-slide-down  { from { opacity:0; transform:translateY(-120px); } }
@keyframes st-in-zoom        { from { opacity:0; transform:scale(.45); } }
@keyframes st-in-pop         { 0% { opacity:0; transform:scale(0); } 65% { opacity:1; transform:scale(1.14); } 82% { transform:scale(.96); } 100% { transform:scale(1); } }
@keyframes st-in-drop        { 0% { opacity:0; transform:translateY(-220px); } 55% { opacity:1; transform:translateY(0); } 72% { transform:translateY(-34px); } 86% { transform:translateY(0); } 93% { transform:translateY(-9px); } 100% { transform:translateY(0); } }
@keyframes st-in-spin        { from { opacity:0; transform:rotate(-200deg) scale(.25); } }
@keyframes st-in-flip        { from { opacity:0; transform:perspective(900px) rotateY(95deg); } }
@keyframes st-in-flip-x      { from { opacity:0; transform:perspective(900px) rotateX(95deg); } }
@keyframes st-in-blur        { from { opacity:0; filter:blur(22px); transform:scale(1.08); } }
@keyframes st-in-wipe        { from { clip-path:inset(0 100% 0 0); } to { clip-path:inset(0 0 0 0); } }
@keyframes st-in-wipe-up     { from { clip-path:inset(100% 0 0 0); } to { clip-path:inset(0 0 0 0); } }
@keyframes st-in-wipe-center { from { clip-path:inset(0 50% 0 50%); } to { clip-path:inset(0 0 0 0); } }
@keyframes st-in-glitch      { 0% { opacity:0; transform:translateX(-30px) skewX(-25deg); } 20% { opacity:1; transform:translateX(18px) skewX(14deg); } 35% { opacity:.3; transform:translateX(-10px); }
                               50% { opacity:1; transform:translateX(6px) skewX(-6deg); } 70% { transform:translateX(-3px); } 100% { opacity:1; transform:none; } }
@keyframes st-in-stretch     { 0% { opacity:0; transform:scaleX(0); } 60% { opacity:1; transform:scaleX(1.08); } 100% { transform:scaleX(1); } }

@keyframes st-loop-pulse     { 50% { transform:scale(1.06); } }
@keyframes st-loop-heartbeat { 0%, 100% { transform:scale(1); } 15% { transform:scale(1.13); } 30% { transform:scale(1); } 45% { transform:scale(1.08); } 60% { transform:scale(1); } }
@keyframes st-loop-float     { 50% { transform:translateY(-12px); } }
@keyframes st-loop-swing     { 0%, 100% { transform:rotate(-4deg); } 50% { transform:rotate(4deg); } }
@keyframes st-loop-spin      { to { transform:rotate(360deg); } }
@keyframes st-loop-blink     { 50% { opacity:.3; } }
@keyframes st-loop-shake     { 0%, 100% { transform:translate(0,0); } 20% { transform:translate(-3px,1px); } 40% { transform:translate(3px,-1px); } 60% { transform:translate(-2px,-1px); } 80% { transform:translate(2px,1px); } }
@keyframes st-loop-glow      { 0%, 100% { filter:drop-shadow(0 0 2px var(--st-glow,#fff)); } 50% { filter:drop-shadow(0 0 22px var(--st-glow,#fff)); } }
@keyframes st-loop-breathe   { 50% { opacity:.75; transform:scale(.97); } }
@keyframes st-loop-wobble    { 0%, 100% { transform:skewX(0); } 25% { transform:skewX(-7deg); } 75% { transform:skewX(7deg); } }
@keyframes st-shine          { 0% { background-position:160% 0; } 60%, 100% { background-position:-60% 0; } }

/* Bandeau médias en calque : reprend les médias du bandeau du panneau de contrôle */
.st-media { position:relative; width:100%; height:100%; overflow:hidden; background:rgba(0,0,0,.27); border-radius:8px; }
.st-media > img, .st-media > video { position:absolute; inset:0; width:100%; height:100%; box-sizing:border-box; opacity:0; transition:opacity .8s ease; }
.st-media > img { object-fit:contain; padding:10px; }
.st-media > video { object-fit:cover; }
.st-media > .on { opacity:1; }
.st-media > .st-mph { position:absolute; inset:0; display:none; align-items:center; justify-content:center; font:700 13px/1.2 'Barlow Condensed', sans-serif; letter-spacing:2px; color:rgba(255,255,255,.55); text-transform:uppercase; text-align:center; border:2px dashed rgba(255,255,255,.25); border-radius:inherit; }
.st-media.st-empty > .st-mph { display:flex; }
.st-layer.st-mb-off { display:none; }
.st-layer.st-empty { display:none !important; }

/* Série : victoires (bâtons, rectangles, ronds, texte) */
.st-series { width:100%; height:100%; display:flex; align-items:stretch; justify-content:center; gap:var(--st-gap,6px); --st-on:var(--blue); }
.st-series[data-dir="rtl"] { flex-direction:row-reverse; }
.st-series[data-vert="1"] { flex-direction:column-reverse; }
.st-series[data-vert="1"][data-dir="rtl"] { flex-direction:column; }
.st-series[data-empty="1"] { display:none; }
.st-series > i { flex:1 1 0; min-width:0; min-height:0; background:var(--st-off,rgba(255,255,255,.16)); border-radius:var(--st-r,3px); transition:background .35s, box-shadow .35s; }
.st-series > i.on { background:var(--st-on); animation:st-pip-on .5s cubic-bezier(.34,1.56,.64,1); }
.st-series[data-style="bars"] > i { flex:0 0 var(--st-bw,8px); }
.st-series[data-vert="1"][data-style="bars"] > i { flex:0 0 var(--st-bw,8px); }
.st-series[data-style="dots"] > i { flex:0 0 auto; aspect-ratio:1; border-radius:50%; }
.st-series[data-style="text"] { align-items:center; }
.st-series[data-style="text"] > span { white-space:nowrap; line-height:1; }
@keyframes st-pip-on { 0% { transform:scale(.4); } 100% { transform:scale(1); } }

/* Jauge de boost (joueur suivi) */
.st-boost { position:relative; width:100%; height:100%; --st-team:var(--blue); }
.st-boost[data-team="orange"] { --st-team:var(--orange); }
.st-boost svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; transform:rotate(-90deg); }
.st-boost[data-style="arc"] svg { transform:rotate(135deg); }
.st-b-ring { fill:none; stroke:var(--st-track,rgba(255,255,255,.14)); stroke-width:var(--st-bw,9); stroke-linecap:var(--st-cap,round); }
.st-b-arc { fill:none; stroke:var(--st-fill,var(--st-team)); stroke-width:var(--st-bw,9); stroke-linecap:var(--st-cap,round); stroke-dashoffset:100; transition:stroke-dashoffset .12s linear, stroke .2s; }
.st-b-track { position:absolute; inset:0; overflow:hidden; background:var(--st-track,rgba(255,255,255,.14)); border-radius:var(--st-r,6px); }
.st-b-fill { position:absolute; inset:0; background:var(--st-fill,var(--st-team)); transform-origin:left center; transform:scaleX(0); transition:transform .12s linear, background .2s; }
.st-boost[data-style="vbar"] .st-b-fill { transform-origin:center bottom; transform:scaleY(0); }
.st-b-segs { position:absolute; inset:0; display:flex; gap:var(--st-gap,4px); }
.st-b-segs > i { flex:1; background:var(--st-track,rgba(255,255,255,.14)); border-radius:var(--st-r,3px); transition:background .1s; }
.st-b-segs > i.on { background:var(--st-fill,var(--st-team)); }
.st-boost.full { --st-fill-full:1; }
.st-b-num { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font:900 var(--st-num-size,40px)/1 var(--st-num-font,'Barlow Condensed'), sans-serif; color:var(--st-num-color,#fff); pointer-events:none; }
.st-boost[data-num="off"] .st-b-num { display:none; }
.st-boost[data-num="right"] .st-b-num { justify-content:flex-end; padding-right:.35em; }
.st-boost[data-num="left"] .st-b-num { justify-content:flex-start; padding-left:.35em; }

/* Notifications des sidebars (5 s comme l'animation d'origine : entrée 0-12 %, sortie 80-100 %) */
@keyframes st-notif-fade   { 0% { opacity:0; } 10%, 85% { opacity:1; } 100% { opacity:0; } }
@keyframes st-notif-pop    { 0% { opacity:0; transform:scale(0); } 8% { opacity:1; transform:scale(1.2); } 12%, 82% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(0); } }
@keyframes st-notif-zoom   { 0% { opacity:0; transform:scale(.4); } 12%, 82% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(1.5); } }
@keyframes st-notif-down   { 0% { opacity:0; transform:translateY(-100%); } 12%, 80% { opacity:1; transform:none; } 100% { opacity:0; transform:translateY(-100%); } }
@keyframes st-notif-bounce { 0% { opacity:0; transform:translateY(-130%); } 7% { opacity:1; transform:translateY(0); } 9.5% { transform:translateY(-22%); } 12%, 80% { opacity:1; transform:none; } 100% { opacity:0; transform:translateY(100%); } }
@keyframes st-notif-flip   { 0% { opacity:0; transform:perspective(300px) rotateX(-90deg); } 12%, 82% { opacity:1; transform:perspective(300px) rotateX(0); } 100% { opacity:0; transform:perspective(300px) rotateX(90deg); } }
@keyframes st-notif-spin   { 0% { opacity:0; transform:rotate(-180deg) scale(0); } 12%, 82% { opacity:1; transform:none; } 100% { opacity:0; transform:rotate(180deg) scale(0); } }
@keyframes st-notif-side-blue   { 0% { opacity:0; transform:translateX(-100%); } 12%, 80% { opacity:1; transform:none; } 100% { opacity:0; transform:translateX(-100%); } }
@keyframes st-notif-side-orange { 0% { opacity:0; transform:translateX(100%); } 12%, 80% { opacity:1; transform:none; } 100% { opacity:0; transform:translateX(100%); } }
`;

  const style = document.createElement('style');
  style.id = 'st-runtime-css';
  style.textContent = RUNTIME_CSS;
  document.head.appendChild(style);

  const allOv = document.getElementById('all-overlay') || document.body;
  const back = document.createElement('div');  back.id = 'st-back';
  const front = document.createElement('div'); front.id = 'st-front';
  allOv.insertBefore(back, allOv.firstChild);
  allOv.appendChild(front);

  /* ── Calques ── */
  let layers = [];          // [{ spec, el, media, lottie }]
  const flags = { always: true, game: false, goal: false, replay: false, end: false, win: false, ot: false };

  const has = (id, cls) => { const e = document.getElementById(id); return !!(e && e.classList.contains(cls)); };
  /* Moments du match. « game » = jeu en cours hors but / replay ; « ot » = toute la prolongation.
     Ils sont aussi posés en classes sur <html> (st-m-goal, st-m-replay…) pour que le CSS d'un thème
     puisse masquer un élément de l'overlay pendant un moment (ex. les sidebars pendant le replay). */
  const MOMENT_KEYS = ['game', 'goal', 'wreplay', 'replay', 'wlive', 'end', 'win'];
  const shown = id => { const v = document.getElementById(id); return !!(v && v.style.display === 'block'); };
  function readFlags() {
    const live = has('overlay-root', 'visible');
    flags.live   = live;
    flags.goal   = has('goal-notif', 'show');
    flags.replay = has('replay-bar', 'show');
    flags.end    = has('end-screen', 'visible');
    flags.win    = has('win-screen', 'show');
    flags.ot     = has('ot-notif', 'show') || (live && has('timer', 'ot'));
    /* transitions REPLAY / LIVE : animation CSS (#replay-wipe.rw-active + mot) ou vidéo du thème en cours de lecture */
    const rw = document.getElementById('rw-word');
    const word = rw ? String(rw.dataset.text || rw.textContent || '').trim().toUpperCase() : '';
    const wipeOn = has('replay-wipe', 'rw-active');
    /* mot de la transition recopié sur #replay-wipe (data-st-word="replay" / "live") : un thème peut masquer
       l'animation REPLAY ou LIVE de base (fondu de sortie compris) sans toucher au moment déclenché */
    const rwBox = document.getElementById('replay-wipe');
    if (rwBox) { const k = word === 'LIVE' ? 'live' : word ? 'replay' : ''; if (rwBox.dataset.stWord !== k) rwBox.dataset.stWord = k; }
    flags.wreplay = (wipeOn && word !== 'LIVE') || ['tw-replay-video', 'lc-transition-video', 'rs-transition-video'].some(shown);
    flags.wlive   = (wipeOn && word === 'LIVE') || ['tw-live-video', 'lc-live-video', 'rs-live-video'].some(shown);
    /* un seul moment à la fois, par priorité : la transition REPLAY n'est plus « But » même si le GOAL est encore affiché */
    flags.moment = flags.end ? 'end' : flags.win ? 'win' : flags.wlive ? 'wlive' : flags.wreplay ? 'wreplay'
      : flags.replay ? 'replay' : flags.goal ? 'goal' : live ? 'game' : '';
    flags.game = flags.moment === 'game';
    const root = document.documentElement;
    MOMENT_KEYS.forEach(k => root.classList.toggle('st-m-' + k, flags.moment === k));
    root.classList.toggle('st-m-ot', !!flags.ot);
  }
  /* show : liste de moments (["game","goal"…] ou ["always"]) — ou ancien format texte d'un thème déjà installé.
     « ot » (prolongation) s'ajoute aux autres : vrai pendant toute la prolongation. */
  function isShown(show) {
    if (Array.isArray(show)) return show.includes('always') || show.includes(flags.moment) || (show.includes('ot') && !!flags.ot);
    if (!show || show === 'always') return true;
    if (show === 'game') return !!flags.live;
    return !!flags[show];
  }

  function restart(L) {
    const el = L.el;
    el.classList.remove('st-on');
    void el.offsetWidth;
    el.classList.add('st-on');
    if (L.media && L.media.tagName === 'VIDEO') {
      try { L.media.currentTime = 0; L.media.play().catch(() => {}); } catch (e) {}
    } else if (L.media && L.media.tagName === 'IMG' && L.retrigger) {
      /* GIF / WebP animés : on recharge l'image pour repartir de la première image */
      const base = L.media.dataset.src;
      L.media.src = base + (base.includes('?') ? '&' : '?') + 'r=' + Date.now();
    }
    if (L.lottie) { try { L.lottie.goToAndPlay(0, true); } catch (e) {} }
  }

  function sync() {
    readFlags();
    updateTokens();   // textes à jour avant l'apparition (ex. nom du buteur au début du replay)
    for (const L of layers) {
      /* gshow : moments du dossier qui contient le calque (filtre en plus des siens) */
      const on = !L.spec.hidden && isShown(L.spec.show) && (!L.spec.gshow || isShown(L.spec.gshow));
      if (on && !L.on) restart(L);
      else if (!on && L.on) {
        /* « Lire jusqu'au bout » : la vidéo reste affichée jusqu'à sa fin même si le moment est terminé
           (ex. transition REPLAY perso plus longue que le moment « Anim. REPLAY ») */
        const v = L.media;
        if (L.spec.toEnd && !L.spec.hidden && v && v.tagName === 'VIDEO' && !v.paused && !v.ended) {
          if (!L.holding) {
            L.holding = true;
            const tok = L.holdTok = (L.holdTok || 0) + 1;
            const done = () => { v.removeEventListener('ended', done); if (!L.holding || L.holdTok !== tok) return; L.holding = false; sync(); };
            v.addEventListener('ended', done);
            const left = isFinite(v.duration) && v.duration > 0 ? (v.duration - v.currentTime) * 1000 : 15000;
            setTimeout(done, Math.min(30000, left + 500));
          }
          continue;
        }
        L.holding = false;
        L.el.classList.remove('st-on');
        if (L.media && L.media.tagName === 'VIDEO' && !L.spec.loop) { try { L.media.pause(); } catch (e) {} }
      }
      L.on = on;
    }
  }

  /* ── Textes dynamiques : {blue_name}, {timer}… remplacés par les valeurs en direct ── */
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : ''; };
  const TOKENS = {
    blue_name: () => txt('blue-name'),     orange_name: () => txt('orange-name'),
    blue_score: () => txt('score-blue'),   orange_score: () => txt('score-orange'),
    timer: () => txt('timer'),             league: () => txt('league-label'),
    /* {bo} : « GAME 3 - BO5 » (« GAME 3 » sans BO) · {game} : n° de la game · {bo_num} : « 5 » */
    bo: () => { const s = seriesState(); return s.bo ? `GAME ${Math.min(s.game, s.bo)} - BO${s.bo}` : `GAME ${s.game}`; },
    game: () => String(seriesState().game),
    bo_num: () => String(seriesState().bo || ''),
    goals: () => txt('st-goals'), assists: () => txt('st-assists'), shots: () => txt('st-shots'),
    saves: () => txt('st-saves'), demos: () => txt('st-demos'),
    series_blue: () => { try { return String(state?.series?.blue ?? 0); } catch (e) { return '0'; } },
    series_orange: () => { try { return String(state?.series?.orange ?? 0); } catch (e) { return '0'; } },
    player: () => txt('stat-player-name'), boost: () => txt('boost-big'),
    /* but / replay : buteur, passeur (vide s'il n'y en a pas), équipe du buteur, vitesse du tir */
    scorer: () => { const r = txt('replay-scorer'); return r && r !== '—' ? r : (lastScorerName || ''); },
    assist: () => { const a = txt('replay-assist-name'); return a === '—' ? '' : a; },
    scorer_team: () => {
      const rb = document.getElementById('replay-bar');
      const t = rb && rb.dataset.team !== undefined && rb.dataset.team !== '' && has('replay-bar', 'show') ? +rb.dataset.team : lastScorer;
      return txt(t === 1 ? 'orange-name' : 'blue-name');
    },
    speed: () => txt('replay-spd'),
  };
  const fillTokens = s => String(s || '').replace(/\{(\w+)\}/g, (m, k) => TOKENS[k] ? TOKENS[k]() : m);
  const tokensEmpty = s => [...String(s || '').matchAll(/\{(\w+)\}/g)].some(m => TOKENS[m[1]] && !String(TOKENS[m[1]]() || '').replace(/[—\s]/g, ''));
  function seriesState() {
    let ser = null;
    try { ser = state && state.series; } catch (e) {}
    const blue = +(ser && ser.blue) || 0, orange = +(ser && ser.orange) || 0;
    const bo = ser && ser.bestOf != null ? +ser.bestOf : (+txt('bo-num') || 0);
    return { blue, orange, bo, need: bo ? Math.ceil(bo / 2) : 0, game: blue + orange + 1 };
  }

  /* ── Calque « Série » : victoires d'une équipe en bâtons, rectangles, ronds ou texte ── */
  function updateSeriesLayer(L) {
    const s = seriesState(), sp = L.spec;
    const wins = sp.team === 'orange' ? s.orange : s.blue;
    const box = L.ser;
    box.dataset.empty = s.need ? '' : '1';
    if (sp.style === 'text') {
      const fmt = sp.fmt || 'wins';
      const v = fmt === 'need' ? `${wins} / ${s.need}` : fmt === 'series' ? `${s.blue} - ${s.orange}` : fmt === 'bo' ? TOKENS.bo() : String(wins);
      const span = box.firstChild || box.appendChild(document.createElement('span'));
      if (span.textContent !== v) span.textContent = v;
      return;
    }
    if (box.childElementCount !== s.need) {
      box.innerHTML = '';
      for (let i = 0; i < s.need; i++) box.appendChild(document.createElement('i'));
      L.serWins = -1;
    }
    if (L.serWins !== wins) {
      [...box.children].forEach((p, i) => p.classList.toggle('on', i < wins));
      L.serWins = wins;
    }
  }

  /* ── Calque « Jauge de boost » : boost du joueur suivi (anneau, barre, segments, chiffre) ── */
  let boostRaf = 0;
  function boostTick() {
    boostRaf = 0;
    const bl = layers.filter(L => L.bst);
    if (!bl.length) return;
    let p = null;
    try { p = _lastSpecPlayer; } catch (e) {}
    const v = p ? ((p.boost ?? 0) <= 1 ? 0 : Math.min(100, Math.floor(p.boost))) : 0;
    const team = p && p.team === 1 ? 'orange' : 'blue';
    for (const L of bl) {
      const b = L.bst;
      L.el.classList.toggle('st-mb-off', !p && !IS_STUDIO);
      if (b.v === v && b.team === team) continue;
      b.v = v; b.team = team;
      b.box.dataset.team = team;
      b.box.classList.toggle('full', v >= 95);
      if (b.arc) b.arc.style.strokeDashoffset = String((b.sweep || 100) * (1 - v / 100));
      if (b.fill) b.fill.style.transform = b.box.dataset.style === 'vbar' ? `scaleY(${v / 100})` : `scaleX(${v / 100})`;
      if (b.segs) { const n = Math.round(v / 100 * b.segs.length); b.segs.forEach((s, i) => s.classList.toggle('on', i < n)); }
      if (b.num && b.num.textContent !== String(v)) b.num.textContent = v;
    }
    boostRaf = requestAnimationFrame(boostTick);
  }

  /* ── Logos d'équipe : repris des logos de l'overlay (réglés dans le panneau) ── */
  let lastScorer = 0;   // 0 = bleue, 1 = orange — équipe du dernier but
  function teamLogoSrc(team) {
    const w = team === 'winner' || team === 'loser' ? Math.max(0, curWinner()) : -1;
    const side = team === 'scorer' ? (lastScorer === 1 ? 'orange' : 'blue')
      : team === 'winner' ? (w === 1 ? 'orange' : 'blue') : team === 'loser' ? (w === 1 ? 'blue' : 'orange')
      : (team === 'orange' ? 'orange' : 'blue');
    const el = document.getElementById(side + '-logo-img');
    return el ? (el.dataset.logo || el.getAttribute('src') || '') : '';
  }
  /* ── Annonce de but personnalisée (meta.json "goal") : texte du mot, buteur, préfixe, durée ── */
  let goalOpts = null;
  const goalWordEl = document.getElementById('goal-word');
  if (goalWordEl) goalWordEl.dataset.stOrig = goalWordEl.textContent;
  function applyGoalWord() {
    const w = document.getElementById('goal-word');
    if (!w) return;
    const t = goalOpts && goalOpts.text ? String(goalOpts.text) : (w.dataset.stOrig || 'GOAL!');
    if (w.textContent !== t) w.textContent = t;
  }
  let lastScorerName = '';
  function goalSubText(name) {
    if (goalOpts && goalOpts.scorer === false) return '';
    const pre = goalOpts && goalOpts.prefix != null ? String(goalOpts.prefix) : '⚽  ';
    return name ? pre + name : '';
  }
  function setGoalOpts(o) {
    goalOpts = o && typeof o === 'object' ? o : null;
    applyGoalWord();
    /* annonce déjà affichée (aperçu du Studio) : sous-texte mis à jour tout de suite */
    const sub = document.getElementById('goal-sub');
    if (sub && lastScorerName && has('goal-notif', 'show')) sub.textContent = goalSubText(lastScorerName);
  }

  const origOnGoal = window.onGoal;
  if (typeof origOnGoal === 'function') {
    window.onGoal = function (data) {
      try { const t = data && data.scorer && data.scorer.team_num; if (t === 0 || t === 1) lastScorer = t; } catch (e) {}
      updateTokens();
      const r = origOnGoal.apply(this, arguments);
      const name = data && data.scorer && data.scorer.name;
      if (name) lastScorerName = name;
      if (goalOpts) {
        try {
          applyGoalWord();
          const sub = document.getElementById('goal-sub');
          if (sub && (goalOpts.scorer === false || goalOpts.prefix != null)) sub.textContent = goalSubText(name);
          /* durée d'affichage (le minuteur d'origine est de 4 s) */
          if (goalOpts.dur && document.getElementById('goal-notif').classList.contains('show')) {
            clearTimeout(goalT);
            goalT = setTimeout(() => document.getElementById('goal-notif').classList.remove('show'), goalOpts.dur * 1000);
          }
        } catch (e) {}
      }
      return r;
    };
  }

  /* ── Boost meter d'origine en arc (meta.json "boostMeter" : { sweep } en degrés, 360 = cercle complet) :
     l'overlay calcule la jauge pour un cercle ou les 3/4 selon le thème ; on recale la longueur ici.
     Orientation, sens et bouts sont dans le CSS du thème (#boost-svg, #boost-arc). ── */
  let bmOpts = null, bmLast = { pct: 0, team: 0 }, bmDash = '';
  const origSetBoostArc = window.setBoostArc;
  function applyBoostSweep() {
    if (!bmOpts || !bmOpts.sweep) return;
    try {
      const C = typeof ARC_CIRC !== 'undefined' ? ARC_CIRC : 2 * Math.PI * 46;
      const total = C * Math.max(10, Math.min(360, bmOpts.sweep)) / 360;
      const arc = document.getElementById('boost-arc'), tr = document.getElementById('boost-track');
      const dash = `${total} ${C}`;
      if (bmDash !== dash || arc.style.strokeDasharray !== dash) { arc.style.strokeDasharray = dash; if (tr) tr.style.strokeDasharray = dash; bmDash = dash; }
      arc.style.strokeDashoffset = total * (1 - Math.min(+bmLast.pct || 0, 100) / 100);
    } catch (e) {}
  }
  if (typeof origSetBoostArc === 'function') {
    window.setBoostArc = function (pct, team) {
      bmLast = { pct, team };
      const r = origSetBoostArc.apply(this, arguments);
      applyBoostSweep();
      return r;
    };
  }
  function setBoostMeterOpts(o) {
    const had = !!(bmOpts && bmOpts.sweep);
    bmOpts = o && typeof o === 'object' && o.sweep ? o : null;
    if (bmOpts) { bmDash = ''; applyBoostSweep(); return; }
    if (had) {
      /* retour à la jauge du thème : l'overlay recalcule tout */
      try { const tr = document.getElementById('boost-track'); if (tr) tr.style.strokeDasharray = ''; _lastArcTheme = null; origSetBoostArc(bmLast.pct, bmLast.team); } catch (e) {}
    }
  }

  /* ── Écran de fin personnalisé (meta.json "end") : textes, libellés, MVP ── */
  let endOpts = null, lastEnd = null, lastEndData = null, lastWin = -1;
  const END_STATS = ['score', 'goals', 'assists', 'shots', 'saves', 'demos'];
  function applyEndOpts(data) {
    const o = endOpts || {};
    const players = Object.values((data && data.players) || {});
    const winner = data && (data.winner === 0 || data.winner === 1) ? data.winner : -1;
    const names = [0, 1].map(i => (data && data.teams && data.teams[i] && data.teams[i].name) || '');
    /* MVP : meilleur score de l'équipe gagnante (comme d'origine), meilleur score du match, ou aucun */
    const mode = o.mvpMode || 'winner';
    const pool = mode === 'match' ? players : players.filter(p => p.team === winner);
    const best = mode === 'off' ? null : pool.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] || null;
    lastEnd = { winner, names, mvp: best ? { name: best.name, score: best.score ?? 0, team: best.team } : null };
    if (mode !== 'winner') {
      [['end-bl', 0], ['end-or', 1]].forEach(([id, team]) => {
        const el = document.getElementById(id);
        if (el) el.querySelectorAll('.end-p-top').forEach(h => h.classList.toggle('mvp', !!best && best.team === team && h.textContent === best.name));
      });
    }
    /* colonne du MVP repérée par une classe (mise en valeur possible sans :has) */
    document.querySelectorAll('#end-bl .end-p-col, #end-or .end-p-col').forEach(c => c.classList.toggle('st-mvp-col', !!c.querySelector('.end-p-top.mvp')));
    const setT = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== String(v)) e.textContent = v; };
    if (o.winText != null || o.loseText != null) {
      setT('end-result-blue', winner === 0 ? (o.winText ?? 'VICTORY !') : (o.loseText ?? 'DEFEAT'));
      setT('end-result-orange', winner === 1 ? (o.winText ?? 'VICTORY !') : (o.loseText ?? 'DEFEAT'));
    }
    if (o.vs != null) { const v = document.querySelector('#end-screen .end-vs-sep'); if (v) v.textContent = o.vs; }
    if (o.labels) {
      document.querySelectorAll('#end-lbl .end-lbl-text').forEach((e, i) => { const t = o.labels[END_STATS[i]]; if (t) e.textContent = t; });
      ['goals', 'shots', 'saves'].forEach(k => { const e = document.querySelector(`#end-bar-${k} .end-bl-lbl`); if (e && o.labels[k]) e.textContent = o.labels[k]; });
    }
  }
  const origBuildEnd = window.buildEndScreen;
  if (typeof origBuildEnd === 'function') {
    window.buildEndScreen = function (data) {
      const r = origBuildEnd.apply(this, arguments);
      lastEndData = data;
      try { applyEndOpts(data); } catch (e) {}
      return r;
    };
  }
  function setEndOpts(o) {
    endOpts = o && typeof o === 'object' ? o : null;
    /* écran déjà affiché (aperçu du Studio) : reconstruit avec les nouveaux réglages */
    if (lastEndData && has('end-screen', 'visible')) { try { window.buildEndScreen(lastEndData); } catch (e) {} }
  }

  /* ── Victoire de la série (meta.json "win") : titre et sous-titre ── */
  const winLbl = document.getElementById('win-label'), winSub = document.getElementById('win-subtitle');
  if (winLbl) winLbl.dataset.stOrig = winLbl.textContent;
  if (winSub) winSub.dataset.stOrig = winSub.textContent;
  function setWinOpts(o) {
    const w = o && typeof o === 'object' ? o : {};
    if (winLbl) winLbl.textContent = w.label != null ? w.label : winLbl.dataset.stOrig;
    if (winSub) winSub.textContent = w.sub != null ? w.sub : winSub.dataset.stOrig;
  }
  const origCheckWin = window.checkSeriesWin;
  if (typeof origCheckWin === 'function') {
    window.checkSeriesWin = function () {
      const r = origCheckWin.apply(this, arguments);
      try { const s = state.series, need = Math.ceil(s.bestOf / 2); if (s.bestOf && s.blue >= need) lastWin = 0; else if (s.bestOf && s.orange >= need) lastWin = 1; } catch (e) {}
      return r;
    };
  }
  /* équipe gagnante : celle de la victoire de série affichée, sinon celle du dernier écran de fin */
  function curWinner() {
    if (has('win-screen', 'show') && lastWin >= 0) return lastWin;
    if (lastEnd && lastEnd.winner >= 0) return lastEnd.winner;
    return lastWin;
  }
  function teamNameOf(i) {
    try { const n = state && state.game && state.game.teams && state.game.teams[i] && state.game.teams[i].name; if (n) return n; } catch (e) {}
    return txt(i ? 'orange-name' : 'blue-name');
  }
  Object.assign(TOKENS, {
    winner: () => { if (has('win-screen', 'show')) return txt('win-team-name'); const w = curWinner(); return w < 0 ? '' : (lastEnd && lastEnd.names[w]) || teamNameOf(w); },
    loser: () => { const w = curWinner(); return w < 0 ? '' : (!has('win-screen', 'show') && lastEnd && lastEnd.names[1 - w]) || teamNameOf(1 - w); },
    mvp: () => (lastEnd && lastEnd.mvp ? lastEnd.mvp.name : ''),
    mvp_score: () => (lastEnd && lastEnd.mvp ? String(lastEnd.mvp.score) : ''),
    mvp_team: () => (lastEnd && lastEnd.mvp ? lastEnd.names[lastEnd.mvp.team] || teamNameOf(lastEnd.mvp.team) : ''),
  });

  let tokenTimer = null;
  function updateTokens() {
    for (const L of layers) {
      if (L.textEl) {
        const v = fillTokens(L.spec.text);
        if (L.textEl.textContent !== v) L.textEl.textContent = v;
        /* « Masquer si une donnée est vide » : ex. « Passe D : {assist} » sans passeur */
        if (L.spec.hideEmpty) L.el.classList.toggle('st-empty', tokensEmpty(L.spec.text));
      }
      if (L.logoEl) {
        const s = teamLogoSrc(L.spec.team);
        if (s && L.logoEl.dataset.src !== s) { L.logoEl.dataset.src = s; L.logoEl.src = s; }
      }
      if (L.mb) updateMediaLayer(L);
      if (L.ser) updateSeriesLayer(L);
    }
  }

  /* Bandeau médias en calque : suit le média affiché par le bandeau d'origine (#mb-img / #mb-video) */
  function updateMediaLayer(L) {
    const { box, img, vid } = L.mb;
    const banner = document.getElementById('media-banner');
    const oi = document.getElementById('mb-img'), ov = document.getElementById('mb-video');
    const enabled = !!(banner && banner.classList.contains('mb-on'));
    L.el.classList.toggle('st-mb-off', !enabled && !IS_STUDIO);
    const now = performance.now();
    /* fondu sortant terminé (0,8 s) avant de changer de média : sinon le nouveau logo apparaît d'un coup à moitié transparent */
    const off = el => { if (el.classList.contains('on')) { el.classList.remove('on'); L.mbOffAt = now; } };
    const faded = () => !L.mbOffAt || now - L.mbOffAt >= 820;
    let shown = false;
    if (oi && oi.classList.contains('mb-active') && oi.getAttribute('src')) {
      const s = oi.getAttribute('src');
      off(vid); try { vid.pause(); } catch (e) {}
      if (img.dataset.src !== s) {
        if (img.dataset.src) off(img);
        if (faded()) { img.dataset.src = s; img.src = s; }
      }
      if (img.dataset.src === s && faded()) img.classList.add('on');
      shown = true;
    } else if (ov && ov.classList.contains('mb-active') && ov.dataset.mbSrc) {
      const s = ov.dataset.mbSrc;
      off(img);
      if (vid.dataset.src !== s) {
        if (vid.dataset.src) off(vid);
        if (faded()) { vid.dataset.src = s; vid.src = s; }
      }
      if (vid.dataset.src === s && faded()) { vid.classList.add('on'); if (vid.paused) vid.play().catch(() => {}); }
      shown = true;
    } else { off(img); off(vid); }
    if (shown) L.mbSeenAt = now;
    /* cadre « Bandeau médias » (Studio) seulement s'il n'y a vraiment rien à montrer, pas pendant un changement de média */
    box.classList.toggle('st-empty', IS_STUDIO && !shown && (!L.mbSeenAt || now - L.mbSeenAt > 2500));
  }

  /* ── Lottie (animations After Effects exportées avec Bodymovin) : chargé à la demande ── */
  let lottieLoading = null;
  function loadLottieLib() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (!lottieLoading) lottieLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/studio/vendor/lottie_light.min.js';
      s.onload = () => res(window.lottie);
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return lottieLoading;
  }

  const ANIMATED_IMG = /\.(gif|webp|apng|png)(\?|$)/i;

  function clearLayers() {
    for (const L of layers) { if (L.lottie) { try { L.lottie.destroy(); } catch (e) {} } }
    layers = [];
    back.innerHTML = '';
    front.innerHTML = '';
  }

  /* specs : [{ id, type: image|video|text|shape|lottie, url, show, z: front|back, loop, text, hidden }]
     (de haut en bas : le premier est au premier plan) */
  function buildLayers(specs) {
    clearLayers();
    const list = Array.isArray(specs) ? specs : [];
    const pending = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const spec = list[i];
      if (!spec || !spec.id) continue;
      const el = document.createElement('div');
      el.className = 'st-layer';
      el.dataset.l = spec.id;
      el.dataset.show = spec.show || 'always';
      el.dataset.out = spec.out || 'fade';
      el.innerHTML = '<div class="st-anim"><div class="st-loop"><div class="st-kf"><div class="st-c"></div></div></div></div>';
      const c = el.querySelector('.st-c');
      const L = { spec, el, on: false };
      if (spec.type === 'image' && spec.url) {
        const img = document.createElement('img');
        img.alt = ''; img.dataset.src = spec.url; img.src = spec.url;
        c.appendChild(img); L.media = img;
        L.retrigger = /\.gif(\?|$)/i.test(spec.url) && !['always', 'game'].includes(spec.show || 'always');
        pending.push(new Promise(r => { if (img.complete) r(); else { img.onload = img.onerror = r; } }));
      } else if (spec.type === 'video' && spec.url) {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.loop = spec.loop !== false && !spec.toEnd;
        v.src = spec.url;
        c.appendChild(v); L.media = v;
        pending.push(new Promise(r => { if (v.readyState >= 2) r(); else { v.onloadeddata = v.onerror = r; setTimeout(r, 4000); } }));
      } else if (spec.type === 'text') {
        const t = document.createElement('div');
        t.className = 'st-text';
        const span = document.createElement('span');
        span.textContent = fillTokens(spec.text);
        t.appendChild(span);
        c.appendChild(t); L.textEl = span;
      } else if (spec.type === 'logo') {
        const img = document.createElement('img');
        img.alt = ''; img.className = 'st-teamlogo';
        const src = teamLogoSrc(spec.team);
        if (src) { img.dataset.src = src; img.src = src; }
        c.appendChild(img); L.logoEl = img;
        if (src) pending.push(new Promise(r => { if (img.complete) r(); else { img.onload = img.onerror = r; setTimeout(r, 3000); } }));
      } else if (spec.type === 'series') {
        const box = document.createElement('div');
        box.className = 'st-series';
        box.dataset.style = spec.style || 'rects';
        box.dataset.dir = spec.dir || 'ltr';
        if (spec.vertical) box.dataset.vert = '1';
        c.appendChild(box); L.ser = box;
      } else if (spec.type === 'boost') {
        const st = spec.style || 'bar', box = document.createElement('div');
        box.className = 'st-boost'; box.dataset.style = st; box.dataset.num = spec.num || 'center';
        const b = { box };
        if (st === 'ring' || st === 'arc') {
          /* anneau complet ou arc (3/4 par défaut, longueur réglable) — pathLength 100 = pourcentage direct ;
             orientation, sens et bouts viennent du CSS du thème */
          b.sweep = st === 'arc' ? Math.max(10, Math.min(100, (+spec.sweep || 270) / 3.6)) : 100;
          box.innerHTML = `<svg viewBox="0 0 100 100"><circle class="st-b-ring" cx="50" cy="50" r="42" pathLength="100" style="stroke-dasharray:${b.sweep} 100"/><circle class="st-b-arc" cx="50" cy="50" r="42" pathLength="100" style="stroke-dasharray:${b.sweep} 100"/></svg>`;
          b.arc = box.querySelector('.st-b-arc');
        } else if (st === 'segments') {
          const segs = document.createElement('div'); segs.className = 'st-b-segs';
          for (let i = 0; i < (spec.segs || 10); i++) segs.appendChild(document.createElement('i'));
          box.appendChild(segs); b.segs = [...segs.children];
        } else if (st === 'bar' || st === 'vbar') {
          box.innerHTML = '<div class="st-b-track"><div class="st-b-fill"></div></div>';
          b.fill = box.querySelector('.st-b-fill');
        }
        const num = document.createElement('div'); num.className = 'st-b-num'; box.appendChild(num); b.num = num;
        c.appendChild(box); L.bst = b;
      } else if (spec.type === 'media') {
        const box = document.createElement('div'); box.className = 'st-media';
        const vid = document.createElement('video'); vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'auto';
        const img = document.createElement('img'); img.alt = '';
        const ph = document.createElement('div'); ph.className = 'st-mph'; ph.textContent = 'Bandeau médias';
        box.append(vid, img, ph); c.appendChild(box);
        L.mb = { box, img, vid };
      } else if (spec.type === 'shape') {
        const s = document.createElement('div'); s.className = 'st-shape'; c.appendChild(s);
      } else if (spec.type === 'lottie' && spec.url) {
        const box = document.createElement('div'); box.className = 'st-lottie'; c.appendChild(box);
        pending.push(loadLottieLib().then(lib => new Promise(r => {
          L.lottie = lib.loadAnimation({ container: box, renderer: 'svg', loop: spec.loop !== false, autoplay: false, path: spec.url });
          L.lottie.addEventListener('DOMLoaded', () => { if (L.on) L.lottie.goToAndPlay(0, true); r(); });
          L.lottie.addEventListener('data_failed', r);
          setTimeout(r, 4000);
        })).catch(() => {}));
      }
      (spec.z === 'back' ? back : front).appendChild(el);
      layers.push(L);
    }
    clearInterval(tokenTimer);
    if (layers.some(L => ['logo', 'media', 'series'].includes(L.spec.type) || (L.spec.type === 'text' && /\{\w+\}/.test(L.spec.text || '')))) tokenTimer = setInterval(updateTokens, 400);
    cancelAnimationFrame(boostRaf); boostRaf = 0;
    if (layers.some(L => L.bst)) boostRaf = requestAnimationFrame(boostTick);
    /* aperçu du Studio : on lance le bandeau pour voir les médias dans le calque */
    if (IS_STUDIO && layers.some(L => L.spec.type === 'media')) { try { if (!_mbEnabled) startMediaBanner(); } catch (e) {} }
    updateTokens();
    sync();
    return Promise.all(pending.map(x => Promise.resolve(x).catch(() => {})));
  }

  /* Les déclencheurs suivent les classes posées par l'overlay (aucune modification de sa logique) */
  const mo = new MutationObserver(() => sync());
  ['overlay-root', 'goal-notif', 'replay-bar', 'end-screen', 'win-screen', 'ot-notif', 'timer', 'replay-wipe'].forEach(id => {
    const e = document.getElementById(id);
    if (e) mo.observe(e, { attributes: true, attributeFilter: ['class'] });
  });
  /* mot de la transition (REPLAY / LIVE) et vidéos de transition des thèmes (affichées / masquées) */
  const rwWord = document.getElementById('rw-word');
  if (rwWord) mo.observe(rwWord, { attributes: true, attributeFilter: ['data-text'] });
  ['tw-replay-video', 'tw-live-video', 'lc-transition-video', 'lc-live-video', 'rs-transition-video', 'rs-live-video'].forEach(id => {
    const e = document.getElementById(id);
    if (e) mo.observe(e, { attributes: true, attributeFilter: ['style'] });
  });

  /* ── Thème installé : calques lus dans le meta.json ── */
  let loadSeq = 0;
  function loadThemeLayers(theme) {
    const seq = ++loadSeq;
    if (!theme || theme === 'rlcs') { clearLayers(); setGoalOpts(null); setEndOpts(null); setWinOpts(null); setBoostMeterOpts(null); return; }
    fetch(`/themes/${theme}/meta.json`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}))
      .then(m => {
        if (seq !== loadSeq) return;
        setGoalOpts(m && m.goal);
        setEndOpts(m && m.end);
        setWinOpts(m && m.win);
        setBoostMeterOpts(m && m.boostMeter);
        const specs = Array.isArray(m && m.layers) ? m.layers : [];
        buildLayers(specs.map(s => Object.assign({}, s, s.file ? { url: `/themes/${theme}/${String(s.file).split(/[\\/]/).pop()}` } : {})));
      });
  }

  const origApplyTheme = window.applyTheme;
  if (typeof origApplyTheme === 'function' && !IS_STUDIO) {
    window.applyTheme = function (t) {
      const r = origApplyTheme.apply(this, arguments);
      loadThemeLayers(t || 'rlcs');
      return r;
    };
  }

  if (!IS_STUDIO) return;

  /* ══════════════════════════════════════════════════════════════════════
     MODE ÉDITEUR (?studio) — piloté par le Studio (iframe ou rendu PNG)
  ══════════════════════════════════════════════════════════════════════ */
  const STUDIO_THEME = 'rlo-studio';
  /* Le thème choisi dans le panneau ne doit pas remplacer celui du projet */
  window.applyTheme = function () {};

  const baseStyle = document.createElement('style');   baseStyle.id = 'st-base-css';
  const studioStyle = document.createElement('style'); studioStyle.id = 'st-studio-css';
  document.head.appendChild(baseStyle);
  document.head.appendChild(studioStyle);
  /* comme en match (hideOverlay) : pas de boost meter sur les écrans de fin et de victoire — la boucle
     de démo de l'aperçu le réafficherait sinon */
  const sceneStyle = document.createElement('style');
  sceneStyle.textContent = 'html.st-m-end #boost-meter, html.st-m-win #boost-meter { visibility:hidden !important; }';
  document.head.appendChild(sceneStyle);

  let currentBase = null;
  /* Réglages du projet ré-appliqués après la résolution asynchrone du thème de base
     (applyTheme relit le meta.json du thème de base et reposerait ses propres vidéos) */
  let lastWipe, lastEndBg, lastOpts = {};
  function applyProjectMedia() {
    if (lastWipe !== undefined) setWipe(lastWipe, true);
    if (lastEndBg !== undefined) setEndBg(lastEndBg, true);
    setOptions(lastOpts);
  }
  function setTheme(base) {
    if (base === currentBase) return;
    currentBase = base;
    try { origApplyTheme && origApplyTheme(base || 'rlcs'); } catch (e) {}
    document.body.dataset.theme = STUDIO_THEME;
    const link = document.getElementById('theme-stylesheet');
    if (link) link.removeAttribute('href');
    setTimeout(applyProjectMedia, 350);
    setTimeout(applyProjectMedia, 1200);
  }
  function setOptions(o) {
    lastOpts = o || {};
    try {
      if (lastOpts.timerShort != null) {
        currentThemeTimerShort = !!lastOpts.timerShort;
        const tm = document.getElementById('timer');
        if (tm && !tm.classList.contains('ot')) _setText(tm, fmtTimer(300));
      }
    } catch (e) {}
    setGoalOpts(lastOpts.goal || null);
    setEndOpts(lastOpts.end || null);
    setWinOpts(lastOpts.win || null);
    setBoostMeterOpts(lastOpts.boostMeter || null);
  }

  function setCss(baseCss, studioCss) {
    if (baseCss != null && baseStyle.textContent !== baseCss) baseStyle.textContent = baseCss;
    if (studioCss != null && studioStyle.textContent !== studioCss) studioStyle.textContent = studioCss;
    document.body.dataset.theme = STUDIO_THEME;
    try { _invalidateTc(); } catch (e) {}
  }
  let reColorT = null;
  function reColor() {
    clearTimeout(reColorT);
    reColorT = setTimeout(() => {
      try {
        _invalidateTc();
        _refreshBoostTrackCssVars();
        _lastArcTheme = null;
        if (_lastSpecPlayer) { renderBoostMeter(_lastSpecPlayer); renderStatBar(_lastSpecPlayer); }
        if (_lastPlayers) renderSidebar(_lastPlayers);
      } catch (e) {}
    }, 120);
  }

  /* w = null : vidéos du thème de base (comme une fois installé) */
  function setWipe(w, again) {
    if (!again) lastWipe = w ? w : undefined;
    if (!w) return;
    try {
      currentThemeWipe = w && (w.replay || w.live) ? w : null;
      [['replay', 'tw-replay-video'], ['live', 'tw-live-video']].forEach(([k, id]) => {
        const v = document.getElementById(id);
        if (!v) return;
        const src = w && w[k] ? w[k] : '';
        if ((v.getAttribute('src') || '') !== src) { if (src) v.src = src; else { v.removeAttribute('src'); try { v.load(); } catch (e) {} } }
      });
    } catch (e) {}
  }

  function setEndBg(eb, again) {
    if (!again) lastEndBg = eb ? eb : undefined;
    if (!eb) return;
    const video = document.getElementById('end-bg-video'), img = document.getElementById('end-bg-img');
    if (!video || !img) return;
    if (eb && eb.kind === 'video') {
      if (video.getAttribute('src') !== eb.url) video.src = eb.url;
      video.style.display = 'block'; img.style.display = 'none';
    } else if (eb && eb.kind === 'image') {
      if (img.getAttribute('src') !== eb.url) img.src = eb.url;
      img.style.display = 'block'; video.style.display = 'none';
    } else {
      img.style.display = 'none'; img.removeAttribute('src');
      video.style.display = '';
    }
  }

  const BG = {
    stadium: 'url("/img/preview-bg.png") center/cover no-repeat #09090f',
    checker: 'repeating-conic-gradient(#2a2c35 0 25%, #1d1f27 0 50%) 0 0/32px 32px',
    green: '#00b140',
    black: '#000',
    transparent: 'transparent',
  };
  function setBg(mode) { document.body.style.background = BG[mode] || BG.stadium; }

  /* ── Scènes : afficher chaque état de l'overlay pour le mettre en page ── */
  const teamName = i => { try { return state?.game?.teams?.[i]?.name || (i ? 'ORANGE TEAM' : 'BLUE TEAM'); } catch (e) { return i ? 'ORANGE' : 'BLUE'; } };
  const cls = (id, c, on) => { const e = document.getElementById(id); if (e) e.classList.toggle(c, on); };
  let scene = 'game', sceneVid = null, pvWinner = 0;
  /* Aperçu : équipe qui gagne dans les scènes Fin de match / Victoire (0 = bleue, 1 = orange) */
  function setPreviewWinner(w) {
    pvWinner = w === 1 ? 1 : 0;
    if (scene === 'end' || scene === 'win') setScene(scene);
  }
  function resetScenes() {
    try { clearTimeout(goalT); } catch (e) {}
    cls('goal-notif', 'show', false);
    cls('replay-bar', 'show', false);
    cls('end-screen', 'visible', false);
    cls('win-screen', 'show', false);
    cls('ot-notif', 'show', false);
    cls('timer', 'ot', false);
    cls('replay-wipe', 'rw-active', false);
    cls('replay-wipe', 'rw-fadeout', false);
    if (sceneVid) { sceneVid.style.display = 'none'; sceneVid = null; }
    void document.body.offsetWidth;   // les animations d'entrée (annonce de but…) repartent du début
  }
  function setScene(s, o) {
    if (o && o.winner != null) pvWinner = o.winner === 1 ? 1 : 0;
    scene = s || 'game';
    resetScenes();
    try {
      if (scene === 'end' || scene === 'win') {
        hideOverlay(0);
      } else {
        showOverlay();
        cls('boost-meter', 'show', true);
        if (_lastSpecPlayer) { renderBoostMeter(_lastSpecPlayer); renderStatBar(_lastSpecPlayer); }
      }
      /* comme en match : stat bar et boost meter retirés du but jusqu'à la fin du replay */
      if (['goal', 'wreplay', 'replay', 'wlive'].includes(scene)) { cls('stat-bar', 'show', false); cls('boost-meter', 'show', false); }
      if (scene === 'goal') {
        onGoal({ scorer: { team_num: 0, name: 'Ayyjayy' } });
        clearTimeout(goalT);
      } else if (scene === 'replay') {
        /* données de démonstration comme un vrai replay : buteur, passeur, vitesse, équipe */
        lastScorer = 0; lastScorerName = 'Ayyjayy';
        document.getElementById('replay-scorer').textContent = 'Ayyjayy';
        document.getElementById('replay-assist-name').textContent = 'jstn.';
        document.getElementById('replay-spd').textContent = '128';
        document.getElementById('replay-bar').dataset.team = 0;
        cls('replay-bar', 'show', true);
      } else if (scene === 'wreplay' || scene === 'wlive') {
        /* transition figée : vidéo du thème à mi-parcours s'il en a une, sinon l'animation REPLAY / LIVE */
        const word = scene === 'wlive' ? 'LIVE' : 'REPLAY', key = scene === 'wlive' ? 'live' : 'replay';
        const lbl = document.getElementById('rw-word');
        if (lbl) { lbl.textContent = word; lbl.dataset.text = word; }
        const vid = currentThemeWipe && currentThemeWipe[key] ? document.getElementById(scene === 'wlive' ? 'tw-live-video' : 'tw-replay-video') : null;
        if (vid && vid.getAttribute('src')) {
          vid.style.display = 'block'; sceneVid = vid;
          try { vid.pause(); vid.currentTime = isFinite(vid.duration) && vid.duration > 0 ? vid.duration / 2 : 1; } catch (e) {}
        } else cls('replay-wipe', 'rw-active', true);
      } else if (scene === 'ot') {
        cls('ot-notif', 'show', true);
        cls('timer', 'ot', true);
      } else if (scene === 'end') {
        /* match fictif complet (stats de chaque joueur) pour voir tout ce qui se règle */
        const w = pvWinner, logo = i => { try { return state?.game?.teams?.[i]?.logo_url; } catch (e) { return ''; } };
        buildEndScreen({
          winner: w,
          teams: [{ name: teamName(0), score: w === 0 ? 3 : 2, logo_url: logo(0) }, { name: teamName(1), score: w === 0 ? 2 : 3, logo_url: logo(1) }],
          series: state?.series?.bestOf ? state.series : { blue: w === 0 ? 3 : 2, orange: w === 0 ? 2 : 3, bestOf: 5 },
          players: typeof demoEndPlayers === 'function' ? demoEndPlayers(w) : {},
        });
        cls('end-screen', 'visible', true);
      } else if (scene === 'win') {
        const w = pvWinner, color = w === 1 ? tc().oL : tc().bL;
        lastWin = w;
        const nm = document.getElementById('win-team-name');
        nm.textContent = teamName(w);
        nm.style.color = color;
        document.getElementById('win-series-score').textContent = w === 0 ? '3 – 2' : '2 – 3';
        ['win-glow', 'win-bar-top', 'win-bar-bot'].forEach(id => { document.getElementById(id).style.background = color; });
        try {
          const letter = document.getElementById('win-logo-letter');
          letter.textContent = teamName(w).charAt(0).toUpperCase();
          _showLogo(document.getElementById('win-logo-img'), letter, state?.game?.teams?.[w]?.logo_url);
        } catch (e) {}
        cls('win-screen', 'show', true);
      }
    } catch (e) { console.warn('[studio] scène', e); }
    setTimeout(sync, 30);
  }

  /* Aperçu : score de série et BO simulés (scoreboard, calques Série, {bo}) */
  function setSeries(blue, orange, bo) {
    try {
      if (!state) state = { hasGame: true };
      state.series = { blue: +blue || 0, orange: +orange || 0, bestOf: +bo || 0 };
      _setText(document.getElementById('bo-num'), +bo || 0);
      _lastSerKey = '';
      renderSeriesDots();
    } catch (e) {}
    updateTokens();
  }

  /* Rejoue les animations d'un calque (ou de tous) */
  function replay(id) {
    for (const L of layers) if (!id || L.spec.id === id) { if (L.on) restart(L); }
  }

  /* Rendu complet en une fois (export PNG) : résout quand polices, images et vidéos sont prêtes */
  async function render(p) {
    setBg(p.bg || 'stadium');
    setTheme(p.base || 'rlcs');
    setCss(p.baseCss || '', p.studioCss || '');
    setWipe(p.wipe || null);
    setEndBg(p.endBg || null);
    setOptions(p.options || {});
    const ready = buildLayers(p.layers || []);
    pvWinner = p.winner === 1 ? 1 : 0;
    setScene(p.scene || 'game');
    reColor();
    await Promise.race([Promise.all([ready, document.fonts ? document.fonts.ready : null]), new Promise(r => setTimeout(r, 6000))]);
    for (const L of layers) if (L.media && L.media.tagName === 'VIDEO') { try { L.media.currentTime = Math.min(0.5, (L.media.duration || 1) / 2); } catch (e) {} }
    await new Promise(r => setTimeout(r, 1400));
    return true;
  }

  window.__studio = {
    ready: true,
    setTheme, setCss, reColor, setWipe, setEndBg, setOptions, setBg, setScene, replay, render, setSeries, setPreviewWinner,
    get series() { return seriesState(); },
    setLayers: buildLayers,
    get scene() { return scene; },
    get flags() { return Object.assign({}, flags); },
    isShown,
  };
  try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'studio-frame-ready' }, '*'); } catch (e) {}
})();

/* Thème saisonnier (Noël / Halloween) — commun au site overlay.rscast.fr et à l'app.
   La saison est choisie dans le panneau admin du site. window.applySeason(nom) pose
   html[data-season] (couleurs dans season.css) et lance le décor : neige qui tombe et guirlande
   lumineuse pour Noël, chauves-souris et toile d'araignée pour Halloween. Décor toujours
   en arrière-plan visuel (pointer-events: none), coupé si l'utilisateur préfère moins d'animations.
   Le site pose la saison au rendu (data-season dans le HTML) ; l'app l'applique à chaud. */
(function () {
  const SEASONS = ['christmas', 'halloween'];
  /* data-mode="app" sur la balise script : le panneau de l'app dessine lui-même ses décors
     (neige sur les cartes, coulures…) ; le script n'y ajoute que les particules, derrière l'interface */
  const APP = (document.currentScript && document.currentScript.dataset.mode) === 'app';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let canvas = null, ctx = null, raf = 0, parts = [], kind = '', deco = [];

  function clearDeco() {
    cancelAnimationFrame(raf); raf = 0; parts = [];
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    deco.forEach(el => el.remove()); deco = [];
  }

  function addDeco(cls) {
    const el = document.createElement('div');
    el.className = 'season-deco ' + cls;
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    deco.push(el);
    return el;
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ── Noël : flocons (ronds flous + quelques étoiles à 6 branches) ── */
  function flake(top) {
    const r = rnd(1, 3.4);
    return { x: rnd(0, innerWidth), y: top ? rnd(-innerHeight, 0) : rnd(0, innerHeight), r,
             vy: rnd(.35, 1.1) * (r / 2.2), sway: rnd(.4, 1.4), ph: rnd(0, 6.28), star: Math.random() < .18, rot: rnd(0, 6.28) };
  }
  function drawStar(p) {
    const s = p.r * 2.6;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = .9; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); }
    ctx.stroke(); ctx.restore();
  }
  function stepSnow(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.y += p.vy; p.x += Math.sin(t / 1600 + p.ph) * .35 * p.sway; p.rot += .004;
      if (p.y > innerHeight + 10) Object.assign(p, flake(false), { y: -10 });
      if (p.star) drawStar(p);
      else { ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,' + (.35 + p.r / 6) + ')'; ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
    }
  }

  /* ── Halloween : chauves-souris qui traversent en battant des ailes ── */
  function bat() {
    const left = Math.random() < .5, s = rnd(.6, 1.3);
    return { x: left ? -40 : innerWidth + 40, y: rnd(40, innerHeight * .6), vx: (left ? 1 : -1) * rnd(.9, 2), s,
             ph: rnd(0, 6.28), wob: rnd(10, 30), wait: rnd(0, 600) };
  }
  function drawBat(p, t) {
    const flap = Math.sin(t / 90 + p.ph);           // -1..1
    const w = 18 * p.s, h = 8 * p.s * (0.4 + 0.6 * Math.abs(flap));
    ctx.save(); ctx.translate(p.x, p.y + Math.sin(t / 700 + p.ph) * p.wob);
    ctx.fillStyle = 'rgba(20,10,30,.85)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w * .45, -h * (flap > 0 ? 1.4 : .2), -w, -h * .2);
    ctx.quadraticCurveTo(-w * .7, h * .2, -w * .55, h * .7);
    ctx.quadraticCurveTo(-w * .3, h * .2, 0, h * .9);
    ctx.quadraticCurveTo(w * .3, h * .2, w * .55, h * .7);
    ctx.quadraticCurveTo(w * .7, h * .2, w, -h * .2);
    ctx.quadraticCurveTo(w * .45, -h * (flap > 0 ? 1.4 : .2), 0, 0);
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, h * .1, 3.2 * p.s, 0, 6.283); ctx.fill();          // corps
    ctx.fillStyle = 'rgba(255,140,40,.9)';
    ctx.fillRect(-1.8 * p.s, -.4 * p.s, 1.1 * p.s, 1.1 * p.s); ctx.fillRect(.8 * p.s, -.4 * p.s, 1.1 * p.s, 1.1 * p.s);  // yeux
    ctx.restore();
  }
  function stepBats(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      if (p.wait > 0) { p.wait--; continue; }
      p.x += p.vx;
      if (p.x < -60 || p.x > innerWidth + 60) Object.assign(p, bat(), { wait: rnd(120, 900) });
      else drawBat(p, t);
    }
  }

  function startCanvas(step, n) {
    canvas = document.createElement('canvas');
    canvas.className = 'season-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    parts = Array.from({ length: n }, (_, i) => step === stepSnow ? flake(i % 2 === 0) : Object.assign(bat(), { wait: rnd(0, 500) }));
    const loop = t => { step(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }

  window.applySeason = function (name) {
    name = SEASONS.includes(name) ? name : '';
    if (name === kind) return;
    kind = name;
    document.documentElement.dataset.season = name;
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => { kind = ''; window.applySeason(name); }, { once: true }); return; }
    clearDeco();
    if (!name) return;
    if (name === 'christmas') {
      if (!APP) addDeco('season-lights');
      if (!reduce) startCanvas(stepSnow, Math.round(Math.min(APP ? 70 : 110, innerWidth * innerHeight / (APP ? 13000 : 16000))));
    } else {
      if (!APP) { addDeco('season-web'); addDeco('season-glow'); }
      if (!reduce) startCanvas(stepBats, APP ? 4 : 6);
    }
  };
  window.addEventListener('resize', resize);
  /* saison posée dans le HTML par le site : appliquée au chargement */
  const initial = document.documentElement.dataset.season;
  if (initial) { document.documentElement.dataset.season = ''; window.applySeason(initial); }
})();

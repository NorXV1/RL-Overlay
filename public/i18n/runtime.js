/* ── Traduction FR / EN de l'interface ──
   Les dictionnaires public/i18n/fr.json et en.json associent chaque texte français d'origine (la clé) au texte
   à afficher. Ce script traduit la page au chargement puis tout ce qui s'affiche ensuite (fenêtres, messages,
   inspecteur…), et change de langue sans recharger : le texte d'origine de chaque élément est gardé.
   - Clé simple : « Annuler » → « Cancel » (les symboles autour, « ✓ … », « … : », sont gardés tels quels).
   - Clé à trous : « {0} calques » → « {0} layers » (chaque trou est lui-même traduit s'il est connu).
   - Phrase avec mise en forme : « Glisse un <b>côté</b> pour l'incliner » → la phrase entière est traduite
     (balises b, i, strong, em, u, small, br sans attributs).
   Données de départ : window.__I18N_BOOT (servi par /i18n/boot.js) ou window.__i18nData (préchargement Electron).
   Mode statique (overlay) : window.__I18N_STATIC = true → seuls les éléments [data-i18n] sont traduits. */
(function () {
  'use strict';
  if (window.I18N) return;
  const boot = window.__I18N_BOOT || window.__i18nData || {};
  const STATIC = !!window.__I18N_STATIC;
  let lang = boot.lang === 'en' ? 'en' : 'fr';
  const dicts = {};
  if (boot.dict) dicts[lang] = boot.dict;

  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE', 'svg', 'IFRAME', 'CANVAS', 'VIDEO', 'TITLE']);   // <title> : géré à part (titre d'origine gardé)
  const INLINE = new Set(['B', 'I', 'STRONG', 'EM', 'U', 'SMALL', 'BR']);
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'label'];
  const LETTER = /\p{L}/u;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let exact = new Map(), patterns = [], blockPatterns = [], cache = new Map(), identity = true;
  function compile(d) {
    exact = new Map(); patterns = []; blockPatterns = []; cache = new Map(); identity = true;
    for (const k in d) {
      const v = d[k];
      if (typeof v !== 'string' || !v || k.startsWith('//')) continue;
      if (v !== k) identity = false;
      if (/\{\d+\}/.test(k)) {
        const parts = k.split(/(\{\d+\})/), idx = []; let re = '^', anchor = '';
        for (const p of parts) {
          const m = /^\{(\d+)\}$/.exec(p);
          if (m) { re += '([\\s\\S]*?)'; idx.push(+m[1]); }
          else { re += esc(p); if (p.trim().length > anchor.length) anchor = p.trim(); }
        }
        (k.includes('<') ? blockPatterns : patterns).push({ re: new RegExp(re + '$', 'u'), idx, v, anchor, size: k.replace(/\{\d+\}/g, '').length });
      } else exact.set(k, v);
    }
    patterns.sort((a, b) => b.size - a.size);
    blockPatterns.sort((a, b) => b.size - a.size);
  }

  /* traduit un texte normalisé (espaces réduits, sans espaces autour) ; null = inconnu */
  function lookup(core, depth) {
    if (cache.has(core)) return cache.get(core);
    const isBlock = core.includes('<');
    let out = exact.has(core) ? exact.get(core) : null;
    if (out == null && depth < 2) out = pattern(core, depth, isBlock ? blockPatterns : patterns);
    if (out == null && !isBlock) {
      /* symboles / ponctuation autour (« ✓ », « ⚠ », « … », « : ») : traduits sans eux */
      const m = /^([^\p{L}\p{N}{]*)([\s\S]*?)([^\p{L}\p{N}}]*)$/u.exec(core);
      if (m && (m[1] || m[3]) && m[2]) {
        const inner = exact.has(m[2]) ? exact.get(m[2]) : (depth < 2 ? pattern(m[2], depth, patterns) : null);
        if (inner != null) out = m[1] + inner + (lang === 'en' ? m[3].replace(/^\s+(?=[:!?;])/, '') : m[3]);
      }
    }
    if (out == null && !isBlock) {
      /* « en jeu » (mis en minuscules par le code) : même texte que « En jeu », résultat en minuscule */
      const c0 = core[0];
      if (c0 && c0 !== c0.toUpperCase()) {
        const up = exact.get(c0.toUpperCase() + core.slice(1));
        if (up != null) out = up[0].toLowerCase() + up.slice(1);
      }
      /* liste « a, b, c » : chaque élément traduit */
      if (out == null && depth < 2 && core.includes(', ')) {
        const parts = core.split(', ').map(p => lookup(p, depth + 1));
        if (parts.every(p => p != null)) out = parts.join(', ');
      }
    }
    /* « Tag équipe bleue » → « Blue team tag » : majuscule gardée en début de texte */
    if (out && depth === 0 && /^\p{Lu}/u.test(core) && /^\p{Ll}/u.test(out)) out = out[0].toUpperCase() + out.slice(1);
    if (cache.size > 5000) cache.clear();
    cache.set(core, out);
    return out;
  }
  function pattern(core, depth, list) {
    for (const p of list) {
      if (p.anchor && !core.includes(p.anchor)) continue;
      const m = p.re.exec(core);
      if (!m) continue;
      return p.v.replace(/\{(\d+)\}/g, (_, n) => {
        const val = m[p.idx.indexOf(+n) + 1] ?? '';
        const lead = val.match(/^\s*/)[0], trail = val.match(/\s*$/)[0], c = val.trim();
        const t = c && LETTER.test(c) ? lookup(c, depth + 1) : null;
        return t == null ? val : lead + t + trail;
      });
    }
    return null;
  }
  /* texte brut (espaces gardés autour) → texte traduit, ou le même texte */
  function tr(s) {
    if (s == null) return s;
    s = String(s);
    if (identity || !LETTER.test(s)) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const out = lookup(m[2].replace(/\s+/g, ' '), 0);
    if (out == null) return s;
    /* « … <a>lien</a> : suite » : pas d'espace avant « : » en anglais */
    const lead = lang === 'en' && /^[:;!?]/.test(out) ? '' : m[1];
    return lead + out + m[3];
  }
  /* I18N.t('Texte {0}', x) : pour le code (valeurs insérées dans les trous) */
  function t(key, ...vars) {
    const d = dicts[lang];
    const out = (d && typeof d[key] === 'string' && d[key]) || key;
    return vars.length ? out.replace(/\{(\d+)\}/g, (_, n) => vars[n] ?? '') : out;
  }

  /* ── DOM ── */
  const textRec = new WeakMap();    // Text → { orig, out }
  const attrRec = new WeakMap();    // Element → { attr: { orig, out } }
  const blockRec = new WeakMap();   // Element → { orig, out } (phrase avec mise en forme)
  const optOut = n => n.hasAttribute('data-no-i18n') || n.getAttribute('translate') === 'no';
  const skipped = n => SKIP.has(n.nodeName) || n.isContentEditable || optOut(n);
  function skipEl(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentNode) if (skipped(e)) return true;
    return false;
  }
  function doText(node) {
    const d = node.data;
    if (!d || !LETTER.test(d)) { textRec.delete(node); return; }
    const rec = textRec.get(node);
    const orig = rec && rec.out === d ? rec.orig : d;
    const out = tr(orig);
    if (out !== d) node.data = out;
    if (out !== orig || rec) textRec.set(node, { orig, out });
  }
  function doAttr(el, a) {
    const v = el.getAttribute(a);
    let recs = attrRec.get(el);
    if (v == null || !LETTER.test(v)) { if (recs) delete recs[a]; return; }
    const rec = recs && recs[a];
    const orig = rec && rec.out === v ? rec.orig : v;
    const out = tr(orig);
    if (out !== v) el.setAttribute(a, out);
    if (out !== orig || rec) { if (!recs) attrRec.set(el, recs = {}); recs[a] = { orig, out }; }
  }
  /* clé d'une phrase avec mise en forme : texte + balises simples sans attributs ; null sinon */
  function blockKey(el) {
    let hasInline = false, hasText = false, out = '';
    const ser = (node, top) => {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { if (top && LETTER.test(c.data)) hasText = true; out += escHtml(c.data); }
        else if (c.nodeType === 1) {
          if (!INLINE.has(c.nodeName) || c.attributes.length) return false;
          if (top) hasInline = true;
          const n = c.nodeName.toLowerCase();
          if (n === 'br') { out += '<br>'; continue; }
          out += '<' + n + '>';
          if (!ser(c, false)) return false;
          out += '</' + n + '>';
        } else if (c.nodeType !== 8) return false;
      }
      return true;
    };
    if (!el.firstChild || !ser(el, true) || !hasInline || !hasText) return null;
    return out.replace(/\s+/g, ' ').trim();
  }
  function doBlock(el) {
    if (INLINE.has(el.nodeName)) return false;
    const k = blockKey(el);
    if (k == null) return false;
    const rec = blockRec.get(el);
    const mine = !!rec && rec.out === k;          // la phrase affichée est notre traduction
    const orig = mine ? rec.orig : k;
    let out = identity ? null : lookup(orig, 0);
    if (out == null) {
      if (!mine) return false;                     // phrase inconnue : les morceaux sont traduits un par un
      out = orig;                                  // retour au texte d'origine
    }
    if (out !== k) el.innerHTML = out;
    blockRec.set(el, { orig, out: blockKey(el) ?? out });
    return true;
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skipEl(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && skipEl(root)) return;
    if (STATIC) {
      const list = root.nodeType === 1 && root.hasAttribute('data-i18n') ? [root] : [];
      if (root.querySelectorAll) list.push(...root.querySelectorAll('[data-i18n]'));
      for (const el of list) { for (const c of el.childNodes) if (c.nodeType === 3) doText(c); for (const a of ATTRS) if (el.hasAttribute(a)) doAttr(el, a); }
      return;
    }
    if (root.nodeType === 1) { for (const a of ATTRS) if (root.hasAttribute(a)) doAttr(root, a); if (doBlock(root)) return; }
    else if (root.nodeType === 9) root = root.documentElement;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
        if (!optOut(n)) for (const a of ATTRS) if (n.hasAttribute(a)) doAttr(n, a);   // placeholder d'un textarea compris
        if (skipped(n)) return NodeFilter.FILTER_REJECT;
        return doBlock(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      },
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) doText(n);
  }
  /* une modification à l'intérieur d'une phrase mise en forme : on retente la phrase entière */
  function blockAround(node) {
    for (let e = node, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentNode, i++) if (!INLINE.has(e.nodeName) && doBlock(e)) return true;
    return false;
  }

  let titleOrig = null;
  function translateTitle() {
    if (STATIC || !document.title) return;
    if (titleOrig == null) titleOrig = document.title;
    const out = tr(titleOrig);
    if (out !== document.title) titleDesc.set.call(document, out);
  }
  /* le titre de la fenêtre peut être changé par le code : on garde l'original et on le retraduit */
  const titleDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  if (titleDesc && titleDesc.set && !STATIC) {
    Object.defineProperty(document, 'title', {
      configurable: true,
      get() { return titleDesc.get.call(document); },
      set(v) { titleOrig = String(v); titleDesc.set.call(document, tr(titleOrig)); },
    });
  }

  let observer = null;
  function observe() {
    if (STATIC || observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(muts => {
      for (const m of muts) {
        const tg = m.target;
        if (m.type === 'childList') {
          if (tg.nodeName === 'TITLE') continue;
          if (tg.nodeType === 1 && !skipEl(tg) && blockAround(tg)) continue;
          for (const n of m.addedNodes) if (n.isConnected) walk(n);
        } else if (m.type === 'characterData') {
          if (!tg.parentNode || tg.parentNode.nodeName === 'TITLE' || skipEl(tg.parentNode)) continue;
          if (!blockAround(tg.parentNode)) doText(tg);
        } else if (m.type === 'attributes') { if (!optOut(tg) && !skipEl(tg.parentNode)) doAttr(tg, m.attributeName); }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* boîtes natives : le message est traduit */
  if (!STATIC) for (const fn of ['alert', 'confirm', 'prompt']) {
    const orig = window[fn];
    if (typeof orig === 'function') window[fn] = function (msg, ...rest) { return orig.call(window, tr(msg), ...rest); };
  }

  function apply() {
    compile(dicts[lang] || {});
    document.documentElement.lang = lang;
    if (document.readyState !== 'loading') { walk(document.documentElement); translateTitle(); }
  }

  /* ── changement de langue ── */
  const listeners = [];
  async function loadDict(l) {
    if (dicts[l]) return dicts[l];
    const api = window.electronAPI;
    if (api && api.i18nGet) { const r = await api.i18nGet(l); if (r && r.dict) return (dicts[l] = r.dict); }
    const r = await fetch('/i18n/' + l + '.json', { cache: 'no-store' });
    return (dicts[l] = await r.json());
  }
  async function setLang(l, opts = {}) {
    l = l === 'en' ? 'en' : 'fr';
    if (l === lang && dicts[l]) return lang;
    try { await loadDict(l); } catch (e) { console.warn('[i18n]', e); return lang; }
    lang = l;
    apply();
    if (opts.broadcast !== false && channel) try { channel.postMessage({ lang }); } catch (e) {}
    for (const f of listeners) try { f(lang); } catch (e) {}
    return lang;
  }
  /* autres fenêtres de la même app (panneau ↔ Studio) et fenêtres Electron */
  let channel = null;
  try { channel = new BroadcastChannel('rlo-i18n'); channel.onmessage = e => { if (e.data && e.data.lang) setLang(e.data.lang, { broadcast: false }); }; } catch (e) {}
  try { if (window.electronAPI && window.electronAPI.onI18nChange) window.electronAPI.onI18nChange(l => setLang(l, { broadcast: false })); } catch (e) {}

  window.I18N = {
    get lang() { return lang; },
    t, tr, setLang,
    onChange(f) { listeners.push(f); },
    translate: walk,
  };

  compile(dicts[lang] || {});
  document.documentElement.lang = lang;
  if (!dicts[lang]) loadDict(lang).then(apply).catch(() => {});
  /* pendant le chargement de la page, rien n'est affiché avant la traduction (pas de français qui clignote) */
  const root = document.documentElement;
  const start = () => { walk(root); translateTitle(); observe(); root.classList.remove('i18n-wait'); };
  if (document.readyState === 'loading') {
    if (!identity && !STATIC) {
      const st = document.createElement('style');
      st.textContent = 'html.i18n-wait body{visibility:hidden!important}';
      (document.head || root).appendChild(st);
      root.classList.add('i18n-wait');
      setTimeout(() => root.classList.remove('i18n-wait'), 3000);
    }
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else start();
})();

'use strict';
/**
 * RL Overlay — Build & Obfuscation
 *
 *  node build.js       → copie obfusquée du projet dans dist/rl-overlay/
 *  npm run package     → electron-builder appelle afterPack() (ce fichier, voir "build.afterPack" dans
 *                        package.json) : le code est obfusqué DANS l'application empaquetée
 *                        (resources/app) juste avant la création de l'installeur. Si l'obfuscation
 *                        échoue, le packaging s'arrête : jamais d'installeur avec le code en clair.
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fse  = require('fs-extra');
const fs   = require('fs');
const path = require('path');

const SRC  = __dirname;
const DIST = path.join(__dirname, 'dist', 'rl-overlay');

// ── Fichiers/dossiers exclus du dist (node build.js) ────────
const EXCLUDE = new Set([
  'node_modules', 'dist', '.git', '.github', '.claude', '.vs',
  'build.js', 'settings.json', 'memory', 'studio-work',
]);

// ── Bibliothèques tierces : copiées telles quelles (déjà minifiées, pas notre code) ──
const THIRD_PARTY_DIRS = new Set(['node_modules', 'vendor']);
const isThirdParty = rel => rel.split(path.sep).some(p => THIRD_PARTY_DIRS.has(p)) || /\.min\.js$/i.test(rel);

// ── Config obfuscation (niveau fort) ────────────────────────
const OBF_CONFIG = {
  compact:                              true,
  controlFlowFlattening:                true,
  controlFlowFlatteningThreshold:       0.75,
  deadCodeInjection:                    true,
  deadCodeInjectionThreshold:           0.4,
  debugProtection:                      false,
  disableConsoleOutput:                 false,
  identifierNamesGenerator:             'hexadecimal',
  log:                                  false,
  numbersToExpressions:                 true,
  renameGlobals:                        false,
  selfDefending:                        true,
  simplify:                             true,
  splitStrings:                         true,
  splitStringsChunkLength:              10,
  stringArray:                          true,
  stringArrayCallsTransform:            true,
  stringArrayCallsTransformThreshold:   0.75,
  stringArrayEncoding:                  ['rc4'],
  stringArrayIndexShift:                true,
  stringArrayRotate:                    true,
  stringArrayShuffle:                   true,
  stringArrayWrappersCount:             3,
  stringArrayWrappersChainedCalls:      true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType:              'function',
  stringArrayThreshold:                 0.75,
  /* NE PAS ACTIVER (javascript-obfuscator 5.4.2) : un objet passé en argument dans une fonction fléchée
     courte est figé au premier appel — (req, res) => res.json({ ...settings }) renvoyait toujours les
     réglages du démarrage. */
  transformObjectKeys:                  false,
  unicodeEscapeSequence:                false,
};

function obfuscate(code) {
  return JavaScriptObfuscator.obfuscate(code, { ...OBF_CONFIG, sourceMap: false }).getObfuscatedCode();
}

const kb = f => (fs.statSync(f).size / 1024).toFixed(1);

// ── Traitement .js ──────────────────────────────────────────
function processJS(srcFile, destFile, root) {
  const before = kb(srcFile);
  const code   = fs.readFileSync(srcFile, 'utf8');
  const result = obfuscate(code);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, result, 'utf8');
  console.log(`  [JS]   ${path.relative(root, srcFile).padEnd(36)} ${before} KB  →  ${kb(destFile)} KB`);
}

// ── Traitement .html (obfusque chaque bloc <script>) ────────
// Un bloc qui ne passe pas l'obfuscation arrête le build (sinon il partirait en clair).
function processHTML(srcFile, destFile, root) {
  const before = kb(srcFile);
  let html  = fs.readFileSync(srcFile, 'utf8');
  let count = 0;
  html = html.replace(/<script>([\s\S]*?)<\/script>/gi, (_match, js) => {
    if (!js.trim()) return _match;
    count++;
    try {
      return `<script>${obfuscate(js)}</script>`;
    } catch (e) {
      throw new Error(`bloc <script> #${count} de ${path.relative(root, srcFile)} : ${e.message}`);
    }
  });
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, html, 'utf8');
  console.log(`  [HTML] ${path.relative(root, srcFile).padEnd(36)} ${before} KB  →  ${kb(destFile)} KB  (${count} bloc(s) JS)`);
}

function walk(dir, exclude) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (exclude.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, exclude));
    else out.push(full);
  }
  return out;
}

/* Obfusque les .js et les <script> des .html de srcRoot vers destRoot (même dossier = sur place).
   Les autres fichiers sont copiés si destRoot est différent. */
function obfuscateTree(srcRoot, destRoot, exclude) {
  const n = { js: 0, html: 0, copy: 0, third: 0 };
  for (const srcFile of walk(srcRoot, exclude)) {
    const rel      = path.relative(srcRoot, srcFile);
    const destFile = path.join(destRoot, rel);
    const ext      = path.extname(srcFile).toLowerCase();
    if (ext === '.js' && !isThirdParty(rel)) { processJS(srcFile, destFile, srcRoot); n.js++; }
    else if (ext === '.html')                 { processHTML(srcFile, destFile, srcRoot); n.html++; }
    else {
      if (ext === '.js') n.third++;
      if (srcRoot !== destRoot) { fs.mkdirSync(path.dirname(destFile), { recursive: true }); fse.copySync(srcFile, destFile); n.copy++; }
    }
  }
  return n;
}

function summary(n, where) {
  console.log('\n─────────────────────────────────────────────');
  console.log(`✔  ${n.js} fichier(s) JS obfusqués`);
  console.log(`✔  ${n.html} fichier(s) HTML (blocs <script> obfusqués)`);
  if (n.third) console.log(`•  ${n.third} bibliothèque(s) tierce(s) laissée(s) telle(s) quelle(s) (vendor, .min.js)`);
  if (n.copy)  console.log(`✔  ${n.copy} fichier(s) copiés`);
  console.log(`\n  ${where}`);
  console.log('─────────────────────────────────────────────\n');
}

// ── node build.js : dist/rl-overlay/ ─────────────────────────
function buildDist() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     RL Overlay — Build & Obfuscation     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  fse.removeSync(DIST);
  fse.ensureDirSync(DIST);
  console.log(`Destination : ${DIST}\n`);

  const n = obfuscateTree(SRC, DIST, EXCLUDE);

  // settings.json vierge (ne pas distribuer les paramètres personnels)
  const cleanSettings = {
    mediaBanner: { enabled: false },
    league:  'SEMAINE 1 // LIGUE 1',
    bestOf:  7,
    series:  { blue: 0, orange: 0 },
  };
  fs.writeFileSync(path.join(DIST, 'settings.json'), JSON.stringify(cleanSettings, null, 2), 'utf8');
  console.log(`  [GEN]  settings.json (vierge)`);
  summary(n, 'Dist prêt → dist/rl-overlay/');
}

// ── npm run package : hook afterPack d'electron-builder ─────
async function afterPack(context) {
  const res = context.packager && typeof context.packager.getResourcesDir === 'function'
    ? context.packager.getResourcesDir(context.appOutDir)
    : path.join(context.appOutDir, 'resources');
  const appDir = path.join(res, 'app');
  if (!fs.existsSync(path.join(appDir, 'package.json'))) {
    throw new Error(`[obfuscation] dossier de l'application introuvable : ${appDir} (asar doit rester désactivé)`);
  }
  console.log('\n  ── Obfuscation de l\'application empaquetée ──');
  console.log(`  ${appDir}\n`);
  const t0 = Date.now();
  const n = obfuscateTree(appDir, appDir, new Set(['node_modules']));
  if (!n.js) throw new Error('[obfuscation] aucun fichier JS obfusqué — packaging arrêté');
  summary(n, `Application obfusquée en ${((Date.now() - t0) / 1000).toFixed(0)} s → création de l'installeur`);
}

module.exports = afterPack;
module.exports.default = afterPack;

if (require.main === module) buildDist();

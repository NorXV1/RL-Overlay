'use strict';
/**
 * RL Overlay — Build & Obfuscation
 * Usage : node build.js
 * Output: dist/rl-overlay/  (prêt à distribuer)
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fse  = require('fs-extra');
const fs   = require('fs');
const path = require('path');

const SRC  = __dirname;
const DIST = path.join(__dirname, 'dist', 'rl-overlay');

// ── Fichiers/dossiers exclus du dist ────────────────────────
const EXCLUDE = new Set([
  'node_modules', 'dist', '.git', '.claude',
  'build.js', 'settings.json', 'memory',
]);

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
  transformObjectKeys:                  true,
  unicodeEscapeSequence:                false,
};

function obfuscate(code) {
  return JavaScriptObfuscator.obfuscate(code, { ...OBF_CONFIG, sourceMap: false }).getObfuscatedCode();
}

// ── Traitement .js ──────────────────────────────────────────
function processJS(srcFile, destFile) {
  const code  = fs.readFileSync(srcFile, 'utf8');
  const result = obfuscate(code);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, result, 'utf8');
  const a = (fs.statSync(srcFile).size  / 1024).toFixed(1);
  const b = (fs.statSync(destFile).size / 1024).toFixed(1);
  console.log(`  [JS]   ${path.relative(SRC, srcFile).padEnd(36)} ${a} KB  →  ${b} KB`);
}

// ── Traitement .html (obfusque chaque bloc <script>) ────────
function processHTML(srcFile, destFile) {
  let html  = fs.readFileSync(srcFile, 'utf8');
  let count = 0;
  html = html.replace(/<script>([\s\S]*?)<\/script>/gi, (_match, js) => {
    if (!js.trim()) return _match;
    try {
      count++;
      return `<script>${obfuscate(js)}</script>`;
    } catch (e) {
      console.warn(`  [WARN] bloc #${count} dans ${path.relative(SRC, srcFile)} : ${e.message}`);
      return _match;
    }
  });
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, html, 'utf8');
  const a = (fs.statSync(srcFile).size  / 1024).toFixed(1);
  const b = (fs.statSync(destFile).size / 1024).toFixed(1);
  console.log(`  [HTML] ${path.relative(SRC, srcFile).padEnd(36)} ${a} KB  →  ${b} KB  (${count} bloc(s) JS)`);
}

// ── Copie brute ──────────────────────────────────────────────
function copyFile(srcFile, destFile) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fse.copySync(srcFile, destFile);
  console.log(`  [COPY] ${path.relative(SRC, srcFile)}`);
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════╗');
console.log('║     RL Overlay — Build & Obfuscation     ║');
console.log('╚══════════════════════════════════════════╝\n');

fse.removeSync(DIST);
fse.ensureDirSync(DIST);
console.log(`Destination : ${DIST}\n`);

const files = walk(SRC);
let jsCount = 0, htmlCount = 0, copyCount = 0;

for (const srcFile of files) {
  const rel      = path.relative(SRC, srcFile);
  const destFile = path.join(DIST, rel);
  const ext      = path.extname(srcFile).toLowerCase();

  if (ext === '.js') {
    processJS(srcFile, destFile);
    jsCount++;
  } else if (ext === '.html') {
    processHTML(srcFile, destFile);
    htmlCount++;
  } else {
    copyFile(srcFile, destFile);
    copyCount++;
  }
}

// settings.json vierge (ne pas distribuer les paramètres personnels)
const cleanSettings = {
  mediaBanner: { enabled: false },
  league:  'SEMAINE 1 // LIGUE 1',
  bestOf:  7,
  series:  { blue: 0, orange: 0 },
};
fs.writeFileSync(path.join(DIST, 'settings.json'), JSON.stringify(cleanSettings, null, 2), 'utf8');
console.log(`  [GEN]  settings.json (vierge)`);

console.log('\n─────────────────────────────────────────────');
console.log(`✔  ${jsCount} fichier(s) JS obfusqués`);
console.log(`✔  ${htmlCount} fichier(s) HTML (blocs <script> obfusqués)`);
console.log(`✔  ${copyCount} fichier(s) copiés`);
console.log(`\n  Dist prêt → dist/rl-overlay/`);
console.log('─────────────────────────────────────────────\n');

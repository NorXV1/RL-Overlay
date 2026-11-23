/* Construit RL-Overlay.streamDeckPlugin (vérifié par l'outil d'Elgato) et le copie dans l'app :
   public/streamdeck/ — livré avec l'installeur, ouvert par le bouton « Installer le plugin » du panneau.
   Usage : npm run pack (dans streamdeck/) */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const uuid = "fr.rscast.rl-overlay";
const out = path.join(root, "dist");
const target = path.join(root, "..", "public", "streamdeck", "RL-Overlay.streamDeckPlugin");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
execFileSync(process.execPath, [path.join(root, "node_modules", "@elgato", "cli", "bin", "streamdeck.mjs"), "pack", `${uuid}.sdPlugin`, "--output", out, "--force", "--no-update-check"], {
	cwd: root,
	stdio: "inherit",
});
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(path.join(out, `${uuid}.streamDeckPlugin`), target);
console.log(`\n→ ${path.relative(path.join(root, ".."), target)} (${(fs.statSync(target).size / 1024).toFixed(0)} Ko)`);

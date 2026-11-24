/* Images des touches (SVG 144 × 144, dessinées à chaque changement d'état).
   SVG simple (rect, cercle, polygone, chemin, texte, dégradé linéaire) : rendu identique par Stream Deck sur Windows et Mac. */
import { t } from "./i18n";

type RGB = [number, number, number];
const W = 144;
const FONT = `font-family="Arial, Helvetica, sans-serif" font-weight="bold"`;
const GREEN = "#2fd37f", RED = "#ff4d5e", BLUE = "#3d8bff";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const hex = (c: RGB) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const shade = (c: RGB, f: number): RGB => c.map((v) => v * f) as RGB;
const lighten = (c: RGB, f: number): RGB => c.map((v) => v + (255 - v) * f) as RGB;

/** couleur de l'appli « 0,102,255 » → [0, 102, 255] */
export function teamRgb(color: string, fallback: RGB): RGB {
	const p = String(color ?? "").split(",").map((n) => Number(n));
	return p.length === 3 && p.every((n) => Number.isFinite(n)) ? (p as RGB) : fallback;
}
export const BLUE_RGB: RGB = [0, 102, 255];
export const ORANGE_RGB: RGB = [255, 140, 0];

/* largeur approximative d'un texte en capitales grasses (Arial) : ~0,64 em par caractère */
function fitSize(text: string, max: number, width: number, min = 11): number {
	return Math.max(min, Math.min(max, Math.floor(width / (Math.max(1, text.length) * 0.64))));
}
function clip(text: string, size: number, width: number): string {
	const n = Math.max(2, Math.floor(width / (size * 0.64)));
	return text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text;
}
function text(x: number, y: number, size: number, fill: string, content: string, extra = ""): string {
	return `<text x="${x}" y="${y}" text-anchor="middle" ${FONT} font-size="${size}" fill="${fill}" ${extra}>${esc(content)}</text>`;
}
/** texte ajusté à la largeur (réduit, puis coupé avec « … ») */
function fitText(x: number, y: number, max: number, width: number, fill: string, content: string, extra = ""): string {
	const s = fitSize(content, max, width);
	return text(x, y, s, fill, clip(content, s, width), extra);
}
function pill(label: string, y: number, bg: string, fg: string, opacity = 1): string {
	const size = 15, w = Math.min(132, Math.max(48, Math.round(label.length * size * 0.64) + 22));
	return `<rect x="${(W - w) / 2}" y="${y}" width="${w}" height="24" rx="12" fill="${bg}" fill-opacity="${opacity}"/>` + text(W / 2, y + 17.5, size, fg, label);
}
function svg(body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${body}</svg>`;
}
/** fond aux couleurs de l'équipe (dégradé vers le sombre) */
function teamBg(c: RGB, strength = 1): string {
	const top = strength >= 1 ? lighten(c, 0.08) : shade(c, 0.55), bottom = shade(c, strength >= 1 ? 0.3 : 0.18);
	return `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(top)}"/><stop offset="1" stop-color="${hex(bottom)}"/></linearGradient></defs>`
		+ `<rect width="${W}" height="${W}" fill="url(#bg)"/>`;
}
function band(label: string, max = 19, color = "#ffffff"): string {
	return `<rect width="${W}" height="34" fill="#000000" fill-opacity="0.32"/>` + fitText(W / 2, 24, max, 128, color, label);
}
const darkBg = (c = "#15171d") => `<rect width="${W}" height="${W}" fill="${c}"/>`;
const stepLabel = (step: number) => (step < 0 ? "−1" : "+1");

/** image SVG → valeur acceptée par setImage */
export const toImage = (s: string) => `data:image/svg+xml,${encodeURIComponent(s)}`;

/* ───── touche hors ligne (appli fermée ou adresse fausse) ───── */
export function offlineKey(title: string): string {
	return svg(darkBg("#1b1d22") + band(title, 17, "#8a8f99")
		+ `<circle cx="72" cy="72" r="24" fill="none" stroke="#5c616b" stroke-width="6"/>`
		+ `<path d="M55 89 L89 55" stroke="#5c616b" stroke-width="6" stroke-linecap="round"/>`
		+ pill(t("offline"), 110, RED, "#ffffff", 0.9));
}

/* ───── score ───── */
export function scoreKey(o: { name: string; score: number; color: RGB; step: number }): string {
	const dark = hex(shade(o.color, 0.35));
	const s = String(o.score), size = s.length > 2 ? 52 : 70;
	return svg(teamBg(o.color) + band(o.name)
		+ text(W / 2, 99, size, "#ffffff", s)
		+ (o.step < 0 ? pill(stepLabel(o.step), 112, "#000000", "#ffffff", 0.45) : pill(stepLabel(o.step), 112, "#ffffff", dark, 0.92)));
}

/* ───── série ───── */
export function seriesKey(o: { name: string; team: 0 | 1; blue: number; orange: number; bestOf: number; color: RGB; step: number }): string {
	const need = Math.max(1, Math.ceil(o.bestOf / 2)), won = o.team ? o.orange : o.blue;
	const r = Math.min(9, (124 / need - 6) / 2), gap = 2 * r + 6, x0 = W / 2 - ((need - 1) * gap) / 2;
	let pips = "";
	for (let i = 0; i < need; i++) {
		const cx = x0 + i * gap;
		pips += i < won
			? `<circle cx="${cx}" cy="64" r="${r}" fill="#ffffff"/>`
			: `<circle cx="${cx}" cy="64" r="${r - 1.5}" fill="#000000" fill-opacity="0.25" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3"/>`;
	}
	const mine = (team: 0 | 1) => (team === o.team ? `fill="#ffffff"` : `fill="#ffffff" fill-opacity="0.5"`);
	const dark = hex(shade(o.color, 0.35));
	return svg(teamBg(o.color) + band(o.name)
		+ text(W / 2, 48, 12, "#ffffff", t("series"), `fill-opacity="0.75" letter-spacing="1"`)
		+ pips
		+ `<text x="50" y="102" text-anchor="middle" ${FONT} font-size="26" ${mine(0)}>${o.blue}</text>`
		+ text(W / 2, 101, 22, "#ffffff", "-", `fill-opacity="0.6"`)
		+ `<text x="94" y="102" text-anchor="middle" ${FONT} font-size="26" ${mine(1)}>${o.orange}</text>`
		+ (o.step < 0 ? pill(stepLabel(o.step), 112, "#000000", "#ffffff", 0.45) : pill(stepLabel(o.step), 112, "#ffffff", dark, 0.92)));
}

/* ───── série remise à 0 : flèche circulaire autour du score de la série ; confirm = en attente du 2e appui ───── */
export function seriesResetKey(o: { blue: number; orange: number; blueColor: RGB; orangeColor: RGB; confirm: boolean }): string {
	const cx = 72, cy = 70, r = 31, rad = (d: number) => (Math.PI / 180) * d;
	const pt = (d: number, rr = r) => [cx + rr * Math.cos(rad(d)), cy + rr * Math.sin(rad(d))];
	const [x1, y1] = pt(-40), [x2, y2] = pt(220);
	const dir = [-Math.sin(rad(220)), Math.cos(rad(220))], nrm = [Math.cos(rad(220)), Math.sin(rad(220))];
	const tip = [x2 + dir[0] * 10, y2 + dir[1] * 10], b1 = [x2 + nrm[0] * 9 - dir[0] * 2, y2 + nrm[1] * 9 - dir[1] * 2], b2 = [x2 - nrm[0] * 9 - dir[0] * 2, y2 - nrm[1] * 9 - dir[1] * 2];
	const f = (p: number[]) => p.map((v) => v.toFixed(1)).join(",");
	const blue = hex(lighten(o.blueColor, 0.25)), orange = hex(lighten(o.orangeColor, 0.15));
	return svg(darkBg(o.confirm ? "#4a0f17" : "#15171d")
		+ (o.confirm ? `<rect x="3" y="3" width="138" height="138" rx="10" fill="none" stroke="${RED}" stroke-width="6"/>`
			: `<rect width="72" height="6" fill="${hex(o.blueColor)}"/><rect x="72" width="72" height="6" fill="${hex(o.orangeColor)}"/>`)
		+ text(W / 2, 28, 13, o.confirm ? "#ffd0d5" : "#9aa0aa", t("resetSeries"), `letter-spacing="1"`)
		+ `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 1 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>`
		+ `<polygon points="${f(tip)} ${f(b1)} ${f(b2)}" fill="#ffffff"/>`
		+ `<text x="58" y="79" text-anchor="middle" ${FONT} font-size="24" fill="${blue}">${o.blue}</text>`
		+ text(W / 2, 78, 20, "#ffffff", "-", `fill-opacity="0.6"`)
		+ `<text x="86" y="79" text-anchor="middle" ${FONT} font-size="24" fill="${orange}">${o.orange}</text>`
		+ (o.confirm ? pill(t("confirm"), 112, RED, "#ffffff") : pill(t("resetBtn"), 112, "#f5a524", "#2a1a00")));
}

/* ───── HUD à l'écran : écran avec un mini scoreboard ───── */
export function hudKey(o: { available: boolean; shown: boolean }): string {
	const on = o.available && o.shown;
	const screen = `<rect x="32" y="42" width="80" height="50" rx="6" fill="#000000" fill-opacity="0.35" stroke="#ffffff" stroke-width="5"/>`
		+ `<rect x="56" y="50" width="15" height="9" rx="2" fill="${BLUE}"/><rect x="73" y="50" width="15" height="9" rx="2" fill="#ff8c00"/>`
		+ `<path d="M72 92 L72 101 M58 103 L86 103" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>`;
	const accent = !o.available ? "" : `<rect width="${W}" height="6" fill="${on ? GREEN : "#5c616b"}"/>`;
	const badge = !o.available ? pill(t("unavailable"), 112, "#3a3d44", "#b4b8c0") : on ? pill(t("shown"), 112, GREEN, "#06210f") : pill(t("hidden"), 112, "#3a3d44", "#d8dbe0");
	return svg(darkBg() + accent + text(W / 2, 28, 14, "#9aa0aa", t("hudTitle"), `letter-spacing="1"`)
		+ (on ? screen : `<g opacity="0.4">${screen}</g>`) + badge);
}

/* ───── timeout : hexagone « TO » comme sur l'overlay ───── */
function hexagon(cx: number, cy: number, r: number, attrs: string): string {
	const pts = Array.from({ length: 6 }, (_, i) => {
		const a = (Math.PI / 180) * (60 * i - 90);
		return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
	}).join(" ");
	return `<polygon points="${pts}" ${attrs}/>`;
}
export function timeoutKey(o: { name: string; color: RGB; enabled: boolean; used: boolean; remaining: number | null }): string {
	if (o.remaining !== null) {
		const sec = Math.ceil(o.remaining / 1000), clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
		return svg(teamBg(o.color) + band("TIMEOUT")
			+ hexagon(72, 74, 34, `fill="#000000" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"`)
			+ text(W / 2, 90, 44, "#ffffff", clock)
			+ pill(t("stop"), 112, "#000000", "#ffffff", 0.45));
	}
	if (!o.enabled) {
		return svg(darkBg("#1b1d22") + band(o.name, 19, "#8a8f99")
			+ hexagon(72, 70, 28, `fill="none" stroke="#5c616b" stroke-width="5"`)
			+ text(W / 2, 79, 22, "#5c616b", "TO")
			+ pill(t("toOff"), 112, "#3a3d44", "#b4b8c0"));
	}
	if (o.used) {
		return svg(teamBg(o.color, 0) + band(o.name, 19, "#c9ccd2")
			+ hexagon(72, 70, 28, `fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="5"`)
			+ text(W / 2, 79, 22, "#ffffff", "TO", `fill-opacity="0.4"`)
			+ pill(t("used"), 112, "#000000", "#ffffff", 0.45));
	}
	return svg(teamBg(o.color) + band(o.name)
		+ hexagon(72, 70, 30, `fill="#ffffff"`)
		+ text(W / 2, 79, 24, hex(shade(o.color, 0.4)), "TO")
		+ pill(t("ready"), 112, GREEN, "#06210f"));
}

/* ───── overlay visible / caché ───── */
export function overlayKey(visible: boolean): string {
	const eye = `<path d="M30 70 Q72 30 114 70 Q72 110 30 70 Z" fill="none" stroke="#ffffff" stroke-width="7" stroke-linejoin="round"/>`
		+ `<circle cx="72" cy="70" r="14" fill="#ffffff"/>`;
	return visible
		? svg(darkBg() + `<rect width="${W}" height="6" fill="${GREEN}"/>` + text(W / 2, 28, 14, "#9aa0aa", t("overlay"), `letter-spacing="1"`)
			+ eye + pill(t("visible"), 112, GREEN, "#06210f"))
		: svg(darkBg() + `<rect width="${W}" height="6" fill="${RED}"/>` + text(W / 2, 28, 14, "#9aa0aa", t("overlay"), `letter-spacing="1"`)
			+ `<g opacity="0.35">${eye}</g>`
			+ `<path d="M40 100 L104 40" stroke="#15171d" stroke-width="14" stroke-linecap="round"/>`
			+ `<path d="M40 100 L104 40" stroke="${RED}" stroke-width="7" stroke-linecap="round"/>`
			+ pill(t("hidden"), 112, RED, "#ffffff"));
}

/* ───── inverser les équipes ───── */
export function swapKey(o: { blue: RGB; orange: RGB }): string {
	const g = (id: string, c: RGB) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(c)}"/><stop offset="1" stop-color="${hex(shade(c, 0.3))}"/></linearGradient>`;
	return svg(`<defs>${g("b", o.blue)}${g("o", o.orange)}</defs>`
		+ `<polygon points="0,0 86,0 58,${W} 0,${W}" fill="url(#b)"/>`
		+ `<polygon points="86,0 ${W},0 ${W},${W} 58,${W}" fill="url(#o)"/>`
		+ `<circle cx="72" cy="62" r="32" fill="#101216" fill-opacity="0.82"/>`
		+ `<path d="M56 53 L86 53 M78 45 L86 53 L78 61" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
		+ `<path d="M88 71 L58 71 M66 63 L58 71 L66 79" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
		+ `<rect y="106" width="${W}" height="38" fill="#000000" fill-opacity="0.45"/>`
		+ fitText(W / 2, 131, 18, 128, "#ffffff", t("swap")));
}

/* ───── thème ───── */
function nameLines(name: string): string[] {
	const words = name.toUpperCase().split(/\s+/).filter(Boolean);
	if (words.length < 2 || name.length <= 10) return [name.toUpperCase()];
	/* deux lignes équilibrées */
	let best = [name.toUpperCase()], score = Infinity;
	for (let i = 1; i < words.length; i++) {
		const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "), s = Math.max(a.length, b.length);
		if (s < score) { score = s; best = [a, b]; }
	}
	return best;
}
export function themeKey(o: { label: string | null; mode: "set" | "next"; active: boolean }): string {
	const top = o.mode === "next" ? t("nextTheme") : t("theme");
	const accent = o.mode === "next" ? BLUE : o.active ? GREEN : "#3a3d44";
	const swatch = `<rect x="52" y="40" width="12" height="12" rx="3" fill="${BLUE}"/><rect x="66" y="40" width="12" height="12" rx="3" fill="#ffffff"/><rect x="80" y="40" width="12" height="12" rx="3" fill="#ff8c00"/>`;
	let body = "";
	if (!o.label) body = fitText(W / 2, 84, 14, 124, "#8a8f99", t("noTheme"));
	else {
		const lines = nameLines(o.label);
		const size = Math.min(...lines.map((l) => fitSize(l, lines.length > 1 ? 20 : 24, 124)));
		body = lines.length > 1
			? text(W / 2, 78, size, "#ffffff", clip(lines[0], size, 124)) + text(W / 2, 78 + size + 3, size, "#ffffff", clip(lines[1], size, 124))
			: text(W / 2, 88, size, "#ffffff", clip(lines[0], size, 124));
	}
	const badge = o.mode === "next" ? pill(t("next"), 112, BLUE, "#ffffff") : o.active ? pill(t("active"), 112, GREEN, "#06210f") : pill(t("apply"), 112, "#2a2d34", "#c9ccd2");
	return svg(darkBg() + (o.active || o.mode === "next" ? `<rect x="3" y="3" width="138" height="138" rx="10" fill="none" stroke="${accent}" stroke-width="6"/>` : "")
		+ text(W / 2, 28, 13, "#9aa0aa", top, `letter-spacing="1"`) + swatch + body + badge);
}

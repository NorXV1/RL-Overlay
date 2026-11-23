/* Lien avec l'appli RL Overlay (http://localhost:3000 par défaut, adresse réglable dans le plugin).
   - flux en direct : le WebSocket de l'appli (le même que l'overlay OBS) → score, série, timeouts, affichage, thème ;
   - commandes : l'API de l'appli (POST /api/...), comme les boutons du panneau de contrôle.
   L'appli accepte les programmes du PC (pas d'en-tête Origin) et les adresses du réseau local. */
import streamDeck from "@elgato/streamdeck";

export const DEFAULT_HOST = "localhost:3000";

export type Team = { name: string; tag: string; score: number; color: string };
export type LiveTimeout = { team: number; endsAt: number; duration: number } | null;
export type Result = { ok: boolean; status: number; data: any };

/* thèmes intégrés : mêmes noms que dans le panneau */
const BUILTIN_THEMES: Record<string, string> = {
	rlcs: "Default", neon: "Neon", onyx: "Onyx", nord: "Nord", amber: "Amber", rlcs2026: "RLCS 2026",
	rlcs2023: "RLCS 2023", enisorail: "ENISorail", rlcs2025: "RLCS 2025", "fifa-world-cup": "FIFA WC",
};

/** « localhost », « http://192.168.1.20:3000/ »… → « hôte:port » (port 3000 par défaut) */
export function normalizeHost(value: unknown): string {
	let s = String(value ?? "").trim().replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
	if (!s || !/^[a-z0-9.\-[\]:]+$/i.test(s)) return DEFAULT_HOST;
	if (!/:\d{1,5}$/.test(s)) s += ":3000";
	return s;
}

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

class RlOverlayApp {
	host = DEFAULT_HOST;
	connected = false;
	teams: [Team, Team] = [
		{ name: "BLUE", tag: "", score: 0, color: "0,102,255" },
		{ name: "ORANGE", tag: "", score: 0, color: "255,140,0" },
	];
	series = { blue: 0, orange: 0, bestOf: 7 };
	timeouts = { enabled: false, used: [false, false] as [boolean, boolean], screen: true, live: null as LiveTimeout };
	overlayVisible = true;
	/* HUD à l'écran (overlay par-dessus le jeu) : seulement dans l'application, pas avec le serveur seul */
	hud = { available: false, shown: false };
	theme = "";
	themes: string[] = [];
	themeNames: Record<string, string> = {};

	private ws: WebSocket | undefined;
	private gen = 0;
	private retryTimer: NodeJS.Timeout | undefined;
	private retryDelay = 1000;
	private notifyTimer: NodeJS.Timeout | undefined;
	private listeners = new Set<() => void>();
	private lastSig = "";

	/** appelé (regroupé, ~60 ms) quand l'état affiché change */
	onChange(listener: () => void): void {
		this.listeners.add(listener);
	}

	private notify(): void {
		if (this.notifyTimer) return;
		this.notifyTimer = setTimeout(() => {
			this.notifyTimer = undefined;
			for (const f of this.listeners) {
				try { f(); } catch (e) { streamDeck.logger.error("render", e); }
			}
		}, 60);
	}

	setHost(value: unknown): void {
		const host = normalizeHost(value);
		if (host === this.host && (this.ws || this.retryTimer)) return;
		streamDeck.logger.info(`adresse de l'appli : ${host}`);
		this.host = host;
		this.connect();
	}

	connect(): void {
		const gen = ++this.gen;
		clearTimeout(this.retryTimer);
		this.retryTimer = undefined;
		const old = this.ws;
		this.ws = undefined;
		try { old?.close(); } catch { /* déjà fermé */ }
		if (this.connected) { this.connected = false; this.notify(); }
		let ws: WebSocket;
		try {
			ws = new WebSocket(`ws://${this.host}/?client=streamdeck`);
		} catch {
			this.scheduleRetry(gen);
			return;
		}
		this.ws = ws;
		ws.onopen = () => {
			if (gen !== this.gen) return;
			this.retryDelay = 1000;
			this.connected = true;
			streamDeck.logger.info(`connecté à RL Overlay (${this.host})`);
			void this.loadThemes();
			this.notify();
		};
		ws.onmessage = (ev) => {
			if (gen !== this.gen) return;
			try { if (this.handle(JSON.parse(String(ev.data)))) this.notify(); } catch { /* message ignoré */ }
		};
		ws.onclose = () => {
			if (gen !== this.gen) return;
			this.ws = undefined;
			if (this.connected) { this.connected = false; this.notify(); }
			this.scheduleRetry(gen);
		};
		ws.onerror = () => { /* suivi de onclose */ };
	}

	private scheduleRetry(gen: number): void {
		if (gen !== this.gen) return;
		clearTimeout(this.retryTimer);
		this.retryTimer = setTimeout(() => { if (gen === this.gen) this.connect(); }, this.retryDelay);
		this.retryDelay = Math.min(this.retryDelay * 2, 10000);
	}

	/** applique un message de l'appli ; true si quelque chose d'affiché a changé */
	private handle(msg: any): boolean {
		const { type, data } = msg || {};
		switch (type) {
			case "init":
			case "update_state":
				return this.applyGame(data);
			case "series_update":
				return this.applySeries(data);
			case "timeouts":
				this.applyTimeouts(data);
				return true;
			case "overlay_visible":
				this.overlayVisible = data?.visible !== false;
				return true;
			case "hud":
				this.hud = { available: !!data?.available, shown: !!data?.shown };
				return true;
			case "theme_change":
				if (data?.theme) this.theme = String(data.theme);
				return true;
			case "themes_changed":
				void this.loadThemes();
				return false;
			default:
				return false;
		}
	}

	/* l'état du jeu arrive jusqu'à 30 fois par seconde pendant un match : on ne redessine que s'il a changé */
	private applyGame(gs: any): boolean {
		const t = gs?.game?.teams;
		if (Array.isArray(t)) {
			for (const i of [0, 1] as const) {
				const x = t[i] || {};
				this.teams[i] = {
					name: String(x.name ?? this.teams[i].name),
					tag: String(x.tag ?? ""),
					score: Math.max(0, num(x.score)),
					color: typeof x.color_primary === "string" ? x.color_primary : this.teams[i].color,
				};
			}
		}
		if (gs?.series) this.applySeries(gs.series);
		const sig = JSON.stringify([this.teams, this.series]);
		if (sig === this.lastSig) return false;
		this.lastSig = sig;
		return true;
	}

	private applySeries(s: any): boolean {
		if (!s) return false;
		const before = JSON.stringify(this.series);
		this.series = { blue: Math.max(0, num(s.blue, this.series.blue)), orange: Math.max(0, num(s.orange, this.series.orange)), bestOf: Math.max(1, num(s.bestOf, this.series.bestOf)) };
		return JSON.stringify(this.series) !== before;
	}

	private applyTimeouts(d: any): void {
		const u = Array.isArray(d?.used) ? d.used : [];
		const live = d?.live;
		this.timeouts = {
			enabled: !!d?.enabled,
			used: [!!u[0], !!u[1]],
			screen: d?.screen !== false,
			live: live && (live.team === 0 || live.team === 1)
				? { team: live.team, duration: num(live.duration, 120), endsAt: Date.now() + Math.max(0, num(live.remaining)) }
				: null,
		};
	}

	async loadThemes(): Promise<void> {
		try {
			const r = await fetch(`http://${this.host}/api/themes`, { signal: AbortSignal.timeout(4000) });
			const j: any = await r.json();
			if (Array.isArray(j?.themes)) this.themes = j.themes.map(String);
			if (j?.current) this.theme = String(j.current);
			this.themeNames = j?.names && typeof j.names === "object" ? j.names : {};
			this.notify();
		} catch { /* appli pas encore prête : rechargé à la prochaine connexion */ }
	}

	themeLabel(id: string): string {
		return this.themeNames[id] || BUILTIN_THEMES[id] || id.replace(/[-_]+/g, " ").toUpperCase();
	}

	/* ───── commandes ───── */

	async post(path: string, body: unknown = {}): Promise<Result> {
		try {
			const r = await fetch(`http://${this.host}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(4000),
			});
			let data: any = null;
			try { data = await r.json(); } catch { /* réponse vide */ }
			return { ok: r.ok && data?.ok !== false, status: r.status, data };
		} catch {
			return { ok: false, status: 0, data: null };
		}
	}

	/* les changements sont appliqués tout de suite sur les touches (appuis rapides), puis confirmés par l'appli */
	async addScore(team: 0 | 1, step: number): Promise<boolean> {
		const before = this.teams[team].score, value = Math.max(0, before + step);
		if (value === before) return false;
		this.teams[team].score = value;
		this.notify();
		const r = await this.post("/api/score", team ? { orange: value } : { blue: value });
		if (!r.ok && this.teams[team].score === value) { this.teams[team].score = before; this.notify(); }
		return r.ok;
	}

	/** série : de 0 à la moitié du BO (arrondie au-dessus), comme les pastilles de l'overlay */
	async addSeries(team: 0 | 1, step: number): Promise<boolean> {
		const key = team ? "orange" : "blue", before = this.series[key];
		const value = Math.max(0, Math.min(Math.ceil(this.series.bestOf / 2), before + step));
		if (value === before) return false;
		this.series[key] = value;
		this.notify();
		const r = await this.post("/api/series", { [key]: value });
		if (!r.ok && this.series[key] === value) { this.series[key] = before; this.notify(); }
		return r.ok;
	}

	/** série remise à 0 - 0 (l'appli rend aussi les timeouts et repart d'un historique vide, comme le Reset du panneau) */
	async resetSeries(): Promise<boolean> {
		const before = { ...this.series };
		this.series = { ...this.series, blue: 0, orange: 0 };
		this.notify();
		const r = await this.post("/api/series", { blue: 0, orange: 0 });
		if (!r.ok) { this.series = before; this.notify(); }
		return r.ok;
	}

	async setHud(shown: boolean): Promise<boolean> {
		const r = await this.post("/api/hud", { shown });
		if (r.data && typeof r.data.shown === "boolean") { this.hud = { available: !!r.data.available, shown: r.data.shown }; this.notify(); }
		return r.ok;
	}

	/** take : prendre le timeout · stop : terminer l'écran de timeout · giveBack : rendre le timeout */
	async timeout(team: 0 | 1, mode: "take" | "stop" | "giveBack"): Promise<Result> {
		const body = mode === "stop" ? { stop: true } : { team, used: mode === "take" };
		const r = await this.post("/api/timeouts", body);
		if (r.data?.timeouts) { this.applyTimeouts(r.data.timeouts); this.notify(); }
		return r;
	}

	async setOverlayVisible(visible: boolean): Promise<boolean> {
		const before = this.overlayVisible;
		this.overlayVisible = visible;
		this.notify();
		const r = await this.post("/api/overlay-visible", { visible });
		if (!r.ok) { this.overlayVisible = before; this.notify(); }
		return r.ok;
	}

	async swapTeams(): Promise<boolean> {
		return (await this.post("/api/swap-teams")).ok;
	}

	async setTheme(theme: string): Promise<boolean> {
		const before = this.theme;
		this.theme = theme;
		this.notify();
		const r = await this.post("/api/theme", { theme });
		if (!r.ok) { this.theme = before; this.notify(); }
		return r.ok;
	}

	nextTheme(): string | undefined {
		if (!this.themes.length) return undefined;
		const i = this.themes.indexOf(this.theme);
		return this.themes[(i + 1) % this.themes.length];
	}
}

export const rl = new RlOverlayApp();

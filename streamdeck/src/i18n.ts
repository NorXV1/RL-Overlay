/* Textes affichés sur les touches : français si Stream Deck est en français, anglais sinon. */
const TEXTS = {
	fr: {
		offline: "HORS LIGNE",
		series: "SÉRIE",
		ready: "DISPO",
		used: "PRIS",
		toOff: "TO OFF",
		stop: "STOP",
		overlay: "OVERLAY",
		visible: "VISIBLE",
		hidden: "CACHÉ",
		swap: "INVERSER",
		theme: "THÈME",
		nextTheme: "THÈME SUIVANT",
		active: "ACTIF",
		apply: "APPLIQUER",
		next: "SUIVANT ›",
		noTheme: "CHOISIS UN THÈME",
		resetSeries: "RESET SÉRIE",
		hold: "MAINTENIR",
		hudTitle: "HUD ÉCRAN",
		shown: "AFFICHÉ",
		unavailable: "INDISPO",
	},
	en: {
		offline: "OFFLINE",
		series: "SERIES",
		ready: "READY",
		used: "USED",
		toOff: "TO OFF",
		stop: "STOP",
		overlay: "OVERLAY",
		visible: "VISIBLE",
		hidden: "HIDDEN",
		swap: "SWAP",
		theme: "THEME",
		nextTheme: "NEXT THEME",
		active: "ACTIVE",
		apply: "APPLY",
		next: "NEXT ›",
		noTheme: "PICK A THEME",
		resetSeries: "RESET SERIES",
		hold: "HOLD",
		hudTitle: "SCREEN HUD",
		shown: "SHOWN",
		unavailable: "N/A",
	},
} as const;

export type TextKey = keyof (typeof TEXTS)["fr"];
let lang: "fr" | "en" = "en";

export function setLanguage(language: unknown): void {
	lang = String(language ?? "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function t(key: TextKey): string {
	return TEXTS[lang][key];
}

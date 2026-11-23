/* Plugin Stream Deck de RL Overlay : pilote l'overlay (score, série, timeouts, affichage, équipes, thèmes)
   avec l'état en direct sur les touches. Réglage commun : l'adresse de l'appli (localhost:3000 par défaut). */
import streamDeck from "@elgato/streamdeck";
import { normalizeHost, rl } from "./app";
import { setLanguage } from "./i18n";
import { HudAction } from "./actions/hud";
import { OverlayAction } from "./actions/overlay";
import { ScoreAction } from "./actions/score";
import { SeriesAction } from "./actions/series";
import { SwapAction } from "./actions/swap";
import { ThemeAction } from "./actions/theme";
import { TimeoutAction } from "./actions/timeout";

type GlobalSettings = { host?: string };

streamDeck.logger.setLevel("info");
setLanguage(streamDeck.info.application.language);

streamDeck.actions.registerAction(new ScoreAction());
streamDeck.actions.registerAction(new SeriesAction());
streamDeck.actions.registerAction(new TimeoutAction());
streamDeck.actions.registerAction(new OverlayAction());
streamDeck.actions.registerAction(new HudAction());
streamDeck.actions.registerAction(new SwapAction());
streamDeck.actions.registerAction(new ThemeAction());

/* fenêtre de réglages d'une touche (ui/settings.html) : état de la connexion et liste des thèmes */
function uiState() {
	return {
		type: "state",
		connected: rl.connected,
		host: rl.host,
		theme: rl.theme,
		teams: rl.teams.map((team) => team.tag || team.name),
		themes: rl.themes.map((id) => ({ id, name: rl.themeLabel(id) })),
	};
}
let lastUi = "";
rl.onChange(() => {
	const s = JSON.stringify(uiState());
	if (s === lastUi || !streamDeck.ui.action) return;
	lastUi = s;
	void streamDeck.ui.sendToPropertyInspector(uiState());
});
streamDeck.ui.onSendToPlugin((ev) => {
	const p = ev.payload as { type?: string } | null;
	if (p?.type === "getState") { lastUi = JSON.stringify(uiState()); void streamDeck.ui.sendToPropertyInspector(uiState()); }
	if (p?.type === "reconnect") { rl.connect(); }
});

/* adresse de l'appli changée dans la fenêtre de réglages */
streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => rl.setHost(ev.settings.host));

await streamDeck.connect();
const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
rl.setHost(normalizeHost(settings.host));

import { action } from "@elgato/streamdeck";
import { rl } from "../app";
import { t } from "../i18n";
import { hudKey } from "../render";
import { RlAction } from "./base";

type Settings = { mode?: string };

/** HUD à l'écran : l'overlay par-dessus le jeu, sur l'écran du caster (comme « Afficher le HUD sur l'écran »
 *  du panneau ou Ctrl+Maj+H). Bascule (par défaut), ou toujours afficher / toujours masquer. */
@action({ UUID: "fr.rscast.rl-overlay.hud" })
export class HudAction extends RlAction<Settings> {
	protected draw(): string {
		return hudKey(rl.hud);
	}
	protected offlineTitle(): string {
		return t("hudTitle");
	}
	protected async press(s: Settings): Promise<boolean> {
		if (!rl.hud.available) return false;
		const shown = s.mode === "show" ? true : s.mode === "hide" ? false : !rl.hud.shown;
		return rl.setHud(shown);
	}
}

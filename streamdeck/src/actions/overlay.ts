import { action } from "@elgato/streamdeck";
import { rl } from "../app";
import { t } from "../i18n";
import { overlayKey } from "../render";
import { RlAction } from "./base";

type Settings = { mode?: string };

/** Overlay visible : bascule (par défaut), ou toujours afficher / toujours cacher */
@action({ UUID: "fr.rscast.rl-overlay.overlay" })
export class OverlayAction extends RlAction<Settings> {
	protected draw(): string {
		return overlayKey(rl.overlayVisible);
	}
	protected offlineTitle(): string {
		return t("overlay");
	}
	protected async press(s: Settings): Promise<boolean> {
		const visible = s.mode === "show" ? true : s.mode === "hide" ? false : !rl.overlayVisible;
		return rl.setOverlayVisible(visible);
	}
}

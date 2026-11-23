import { action } from "@elgato/streamdeck";
import { rl } from "../app";
import { t } from "../i18n";
import { themeKey } from "../render";
import { RlAction } from "./base";

type Settings = { mode?: string; theme?: string };

/** Thème : applique le thème choisi (la touche s'allume quand il est actif), ou passe au thème suivant */
@action({ UUID: "fr.rscast.rl-overlay.theme" })
export class ThemeAction extends RlAction<Settings> {
	protected draw(s: Settings): string {
		if (s.mode === "next") return themeKey({ mode: "next", label: rl.theme ? rl.themeLabel(rl.theme) : null, active: true });
		const id = String(s.theme || "");
		return themeKey({ mode: "set", label: id ? rl.themeLabel(id) : null, active: !!id && id === rl.theme });
	}
	protected offlineTitle(s: Settings): string {
		return s.mode === "next" ? t("nextTheme") : t("theme");
	}
	protected async press(s: Settings): Promise<boolean | undefined> {
		if (s.mode === "next") {
			const next = rl.nextTheme();
			return next ? rl.setTheme(next) : false;
		}
		const id = String(s.theme || "");
		if (!id || !rl.themes.includes(id)) return false;
		if (id === rl.theme) return undefined;
		return rl.setTheme(id);
	}
}

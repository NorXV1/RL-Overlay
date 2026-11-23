import { action, type KeyAction } from "@elgato/streamdeck";
import { rl } from "../app";
import { t } from "../i18n";
import { BLUE_RGB, ORANGE_RGB, swapKey, teamRgb } from "../render";
import { RlAction } from "./base";

type Settings = Record<string, never>;

/** Inverser les équipes (noms, tags, logos, timeouts) */
@action({ UUID: "fr.rscast.rl-overlay.swap" })
export class SwapAction extends RlAction<Settings> {
	protected draw(): string {
		return swapKey({ blue: teamRgb(rl.teams[0].color, BLUE_RGB), orange: teamRgb(rl.teams[1].color, ORANGE_RGB) });
	}
	protected offlineTitle(): string {
		return t("swap");
	}
	protected async press(_s: Settings, a: KeyAction<Settings>): Promise<undefined | false> {
		if (!(await rl.swapTeams())) return false;
		await a.showOk();
		return undefined;
	}
}

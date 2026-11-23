import { action } from "@elgato/streamdeck";
import { rl } from "../app";
import { BLUE_RGB, ORANGE_RGB, teamRgb, timeoutKey } from "../render";
import { RlAction, teamLabel, teamOf } from "./base";

type Settings = { team?: string };

/** Timeout d'une équipe.
 *  Appui : prend le timeout (écran de timeout) · pendant l'écran de cette équipe : le termine.
 *  Appui long (0,8 s) : rend le timeout (erreur de clic). Compte à rebours en direct sur la touche. */
@action({ UUID: "fr.rscast.rl-overlay.timeout" })
export class TimeoutAction extends RlAction<Settings> {
	constructor() {
		super();
		/* compte à rebours : redessiné tant qu'un écran de timeout tourne */
		setInterval(() => { if (rl.timeouts.live) this.refreshAll(); }, 500).unref?.();
	}

	protected draw(s: Settings): string {
		const team = teamOf(s), to = rl.timeouts, live = to.live && to.live.team === team ? to.live : null;
		return timeoutKey({
			name: teamLabel(team), color: teamRgb(rl.teams[team].color, team ? ORANGE_RGB : BLUE_RGB),
			enabled: to.enabled, used: to.used[team], remaining: live ? Math.max(0, live.endsAt - Date.now()) : null,
		});
	}
	protected offlineTitle(): string {
		return "TIMEOUT";
	}

	protected async press(s: Settings): Promise<boolean> {
		const team = teamOf(s), to = rl.timeouts;
		if (!to.enabled) return false;
		if (to.live && to.live.team === team) return (await rl.timeout(team, "stop")).ok;
		if (to.used[team]) return false;
		return (await rl.timeout(team, "take")).ok;
	}

	protected override longPress(s: Settings) {
		return async () => {
			const team = teamOf(s);
			if (!rl.timeouts.used[team]) return false;
			return (await rl.timeout(team, "giveBack")).ok;
		};
	}
}

import { action, type KeyAction } from "@elgato/streamdeck";
import { rl } from "../app";
import { BLUE_RGB, ORANGE_RGB, scoreKey, teamRgb } from "../render";
import { RlAction, stepOf, teamLabel, teamOf } from "./base";

type Settings = { team?: string; step?: number };

/** Score : +1 / −1 pour une équipe, la touche montre son score en direct */
@action({ UUID: "fr.rscast.rl-overlay.score" })
export class ScoreAction extends RlAction<Settings> {
	protected draw(s: Settings): string {
		const team = teamOf(s);
		return scoreKey({ name: teamLabel(team), score: rl.teams[team].score, color: teamRgb(rl.teams[team].color, team ? ORANGE_RGB : BLUE_RGB), step: stepOf(s) });
	}
	protected offlineTitle(): string {
		return "SCORE";
	}
	protected async press(s: Settings, _a: KeyAction<Settings>): Promise<boolean> {
		return rl.addScore(teamOf(s), stepOf(s));
	}
}

import { action } from "@elgato/streamdeck";
import { rl } from "../app";
import { t } from "../i18n";
import { BLUE_RGB, ORANGE_RGB, seriesKey, seriesResetKey, teamRgb } from "../render";
import { RlAction, stepOf, teamLabel, teamOf } from "./base";

type Settings = { team?: string; step?: number | string };
const isReset = (s: Settings) => s.step === "reset";

/** Série : un match gagné (ou retiré) pour une équipe, la touche montre ses pastilles et le score de la série.
 *  Mode « Remettre à 0 » : appui long → série à 0 - 0 (et timeouts rendus), comme le bouton Reset du panneau. */
@action({ UUID: "fr.rscast.rl-overlay.series" })
export class SeriesAction extends RlAction<Settings> {
	protected draw(s: Settings): string {
		const colors = { blue: teamRgb(rl.teams[0].color, BLUE_RGB), orange: teamRgb(rl.teams[1].color, ORANGE_RGB) };
		if (isReset(s)) return seriesResetKey({ blue: rl.series.blue, orange: rl.series.orange, blueColor: colors.blue, orangeColor: colors.orange });
		const team = teamOf(s);
		return seriesKey({ name: teamLabel(team), team, ...rl.series, color: team ? colors.orange : colors.blue, step: stepOf(s) });
	}
	protected offlineTitle(): string {
		return t("series");
	}
	protected async press(s: Settings): Promise<boolean> {
		if (isReset(s)) return false;   // appui court : la touche demande de maintenir
		return rl.addSeries(teamOf(s), stepOf(s));
	}
	protected override longPress(s: Settings) {
		return isReset(s) ? () => rl.resetSeries() : null;
	}
	protected override holdRequired(s: Settings): boolean {
		return isReset(s);
	}
}

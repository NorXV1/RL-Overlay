import streamDeck, { action, type KeyAction, type WillDisappearEvent } from "@elgato/streamdeck";
import { rl } from "../app";
import { t } from "../i18n";
import { BLUE_RGB, ORANGE_RGB, seriesKey, seriesResetKey, teamRgb } from "../render";
import { RlAction, stepOf, teamLabel, teamOf } from "./base";

type Settings = { team?: string; step?: number | string };
const isReset = (s: Settings) => s.step === "reset";
const CONFIRM_MS = 3000;

/** Série : un match gagné (ou retiré) pour une équipe, la touche montre ses pastilles et le score de la série.
 *  Mode « Remettre à 0 » : série à 0 - 0 (et timeouts rendus), comme le bouton Reset du panneau.
 *  Pas de remise à 0 par erreur : un 1er appui fait passer la touche en « CONFIRMER ? » (3 s), le 2e remet à 0 ;
 *  un appui long remet à 0 directement. ✓ sur la touche quand c'est fait. */
@action({ UUID: "fr.rscast.rl-overlay.series" })
export class SeriesAction extends RlAction<Settings> {
	private readonly confirming = new Map<string, NodeJS.Timeout>();

	protected draw(s: Settings, id: string): string {
		const colors = { blue: teamRgb(rl.teams[0].color, BLUE_RGB), orange: teamRgb(rl.teams[1].color, ORANGE_RGB) };
		if (isReset(s)) return seriesResetKey({ blue: rl.series.blue, orange: rl.series.orange, blueColor: colors.blue, orangeColor: colors.orange, confirm: this.confirming.has(id) });
		const team = teamOf(s);
		return seriesKey({ name: teamLabel(team), team, ...rl.series, color: team ? colors.orange : colors.blue, step: stepOf(s) });
	}
	protected offlineTitle(): string {
		return t("series");
	}

	protected async press(s: Settings, a: KeyAction<Settings>): Promise<boolean | undefined> {
		if (!isReset(s)) return rl.addSeries(teamOf(s), stepOf(s));
		if (this.confirming.has(a.id)) return this.reset(a);
		this.confirming.set(a.id, setTimeout(() => this.endConfirm(a.id), CONFIRM_MS));
		this.refresh(a.id);
		return undefined;
	}
	protected override longPress(s: Settings, a: KeyAction<Settings>) {
		return isReset(s) ? () => this.reset(a) : null;
	}
	/* multi-action : remise à 0 directe (la multi-action est déjà un choix délibéré) */
	protected override holdRequired(s: Settings): boolean {
		return isReset(s);
	}

	private async reset(a: KeyAction<Settings>): Promise<false | undefined> {
		this.endConfirm(a.id);
		streamDeck.logger.info(`remise à 0 de la série (${rl.series.blue} - ${rl.series.orange})`);
		if (!(await rl.resetSeries())) return false;
		await a.showOk();
		return undefined;
	}
	private endConfirm(id: string): void {
		clearTimeout(this.confirming.get(id));
		if (this.confirming.delete(id)) this.refresh(id);
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		clearTimeout(this.confirming.get(ev.action.id));
		this.confirming.delete(ev.action.id);
		super.onWillDisappear(ev);
	}
}

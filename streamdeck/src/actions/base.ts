/* Base commune des touches RL Overlay : suit les touches visibles et leurs réglages, les redessine quand l'état
   de l'appli change (seulement si l'image change), affiche « hors ligne » quand l'appli ne répond pas,
   et gère l'appui long (0,8 s) pour les touches qui en ont un. */
import streamDeck, {
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { rl } from "../app";
import { offlineKey, toImage } from "../render";

type Settings = Record<string, string | number | boolean | null | undefined>;
type Instance<S extends Settings> = { action: KeyAction<S>; settings: S; image?: string };
type Run = () => Promise<boolean | undefined>;
const LONG_PRESS = 800;

export abstract class RlAction<S extends Settings> extends SingletonAction<S> {
	protected readonly instances = new Map<string, Instance<S>>();
	private readonly holds = new Map<string, { timer: NodeJS.Timeout; long: boolean }>();

	constructor() {
		super();
		rl.onChange(() => this.refreshAll());
	}

	/** image de la touche (id : la touche dessinée) quand l'appli est joignable */
	protected abstract draw(settings: S, id: string): string;
	/** titre de la touche hors ligne (ex. « SCORE ») */
	protected abstract offlineTitle(settings: S): string;
	/** appui sur la touche ; renvoie false pour afficher l'alerte ⚠, true pour ✓ (undefined : rien) */
	protected abstract press(settings: S, action: KeyAction<S>): Promise<boolean | undefined>;
	/** appui long (0,8 s) pour ces réglages, ou null s'il n'y en a pas */
	protected longPress(_settings: S, _action: KeyAction<S>): Run | null {
		return null;
	}
	/** true : seul l'appui long agit (action à risque) ; dans une multi-action, c'est lui qui est lancé */
	protected holdRequired(_settings: S): boolean {
		return false;
	}

	override onWillAppear(ev: WillAppearEvent<S>): void {
		if (!ev.action.isKey()) return;
		this.instances.set(ev.action.id, { action: ev.action, settings: ev.payload.settings });
		this.refresh(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		clearTimeout(this.holds.get(ev.action.id)?.timer);
		this.holds.delete(ev.action.id);
		this.instances.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): void {
		const inst = this.instances.get(ev.action.id);
		if (!inst) return;
		inst.settings = ev.payload.settings;
		this.refresh(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<S>): Promise<void> {
		const a = ev.action as KeyAction<S>, s = ev.payload.settings, long = this.longPress(s, a);
		if (!long) { await this.run(a, () => this.press(s, a)); return; }
		/* multi-action : pas d'appui long possible, action directe */
		if (a.isInMultiAction()) { await this.run(a, this.holdRequired(s) ? long : () => this.press(s, a)); return; }
		clearTimeout(this.holds.get(a.id)?.timer);
		const hold = { long: false, timer: setTimeout(() => { hold.long = true; void this.run(a, long); }, LONG_PRESS) };
		this.holds.set(a.id, hold);
	}

	override async onKeyUp(ev: KeyUpEvent<S>): Promise<void> {
		const a = ev.action as KeyAction<S>, hold = this.holds.get(a.id);
		if (!hold) return;
		this.holds.delete(a.id);
		if (hold.long) return;
		clearTimeout(hold.timer);
		await this.run(a, () => this.press(ev.payload.settings, a));
	}

	protected async run(action: KeyAction<S>, fn: Run): Promise<void> {
		if (!rl.connected) { await action.showAlert(); return; }
		try {
			const ok = await fn();
			if (ok === false) await action.showAlert();
			else if (ok === true && action.isInMultiAction()) await action.showOk();
		} catch (e) {
			streamDeck.logger.error("action", e);
			await action.showAlert();
		}
	}

	protected refresh(id: string): void {
		const inst = this.instances.get(id);
		if (!inst) return;
		const image = rl.connected ? this.draw(inst.settings, id) : offlineKey(this.offlineTitle(inst.settings));
		if (image === inst.image) return;
		inst.image = image;
		void inst.action.setImage(toImage(image));
	}

	protected refreshAll(): void {
		for (const id of this.instances.keys()) this.refresh(id);
	}
}

/** équipe réglée sur la touche : 0 bleue (par défaut), 1 orange */
export const teamOf = (s: { team?: unknown }): 0 | 1 => (s.team === "orange" || s.team === 1 || s.team === "1" ? 1 : 0);
/** pas réglé sur la touche : +1 (par défaut) ou −1 */
export const stepOf = (s: { step?: unknown }): number => (Number(s.step) < 0 ? -1 : 1);
/** nom court de l'équipe : son tag s'il y en a un, sinon son nom */
export const teamLabel = (i: 0 | 1): string => (rl.teams[i].tag || rl.teams[i].name || (i ? "ORANGE" : "BLUE")).toUpperCase();

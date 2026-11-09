import type {ShortProps} from '../schema';
import type {Theme} from '../theme/themes';
import {xOfValue, type Layout} from './layout';
import {domainFor} from './scale';
import {valuesAt, type Hits} from './timeline';

const PLAN_DS = 0.005; // step-progress resolution of the hit search (~1 frame at typical speeds)
const APPEAR_SHARE = 0.35; // the box is fully grown once 35% of the first gain has counted up

/** First positive gain per entity; until it lands the row shows no box, just flag, name and face. */
export const firstGains = (p: ShortProps): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const e of p.entities) out[e.id] = p.steps.map((st) => st.values[e.id] ?? 0).find((v) => v > 0) ?? 0;
	return out;
};

export const appearOf = (value: number, firstGain: number) =>
	firstGain > 0 ? Math.min(1, Math.max(0, value / (firstGain * APPEAR_SHARE))) : 0;

export type Bar = {boxW: number; boxRight: number; appear: number; target: number};

/** Box geometry for one row; target is where an incoming bubble counts (the face), shared by render and planner. */
export const barFor = (
	layout: Layout,
	theme: Theme,
	domain: {min: number; max: number},
	value: number,
	firstGain: number,
	others: boolean | undefined,
): Bar => {
	const appear = others ? 1 : appearOf(value, firstGain);
	const boxW = others ? layout.minBoxW * 1.35 : Math.max(layout.minBoxW * appear, xOfValue(layout, domain, value) - layout.axisX - 3, 0);
	const boxRight = layout.axisX + 3 + boxW;
	const faceLeft = theme.portrait === 'logo' ? boxRight + 6 : boxRight + (theme.tagSide === 'right' ? layout.tagW : 0);
	return {boxW, boxRight, appear, target: faceLeft + layout.portrait * 0.6};
};

/**
 * Bubbles travel right-to-left with their column and count the moment they touch their own row's face,
 * not when the column reaches the axis. Bars move as gains land, so the hits are found by stepping
 * through the timeline once (deterministic, memoised per props).
 */
export const planHits = (p: ShortProps, layout: Layout, theme: Theme): Hits => {
	const first = firstGains(p);
	const hits: Hits = {};
	const pending: Array<{id: string; k: number}> = [];
	for (const e of p.entities) {
		hits[e.id] = p.steps.map((_, k) => k + 1);
		if (e.others) continue;
		p.steps.forEach((st, k) => {
			if ((st.values[e.id] ?? 0) > 0) {
				hits[e.id][k] = Infinity;
				pending.push({id: e.id, k});
			}
		});
	}
	const others = new Set(p.entities.filter((e) => e.others).map((e) => e.id));
	const end = p.steps.length + 0.5;
	for (let s = 0; s <= end && pending.length; s += PLAN_DS) {
		const values = valuesAt(p, s, hits);
		const domain = domainFor(
			p.entities.filter((e) => !others.has(e.id)).map((e) => values[e.id]),
			theme.zoomScale,
		);
		for (let i = pending.length - 1; i >= 0; i--) {
			const {id, k} = pending[i];
			const colX = layout.absorbX + (k + 1 - s) * theme.columnSpacing;
			if (colX <= barFor(layout, theme, domain, values[id], first[id], false).target) {
				hits[id][k] = Math.min(s, k + 1);
				pending.splice(i, 1);
			}
		}
	}
	for (const {id, k} of pending) hits[id][k] = k + 1;
	return hits;
};

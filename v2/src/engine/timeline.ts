import type {ShortProps} from '../schema';

// Motion from the first frame: viewers decide to stay or swipe in the first second (2026-11 analytics: 55% stayed)
export const INTRO_S = 0.15;
// The first column starts already on screen, so the first bubble lands about half a second in
export const START_S = 0.3;
export const OUTRO_S = 2.4;
const COUNT_UP_STEPS = 0.4;
const RANK_SMOOTH_S = 0.38;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOutCubic = (x: number) => {
	const t = clamp01(x);
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export type Timing = {
	duration: number;
	animStart: number;
	animEnd: number;
	stepDur: number;
	steps: number;
};

export const getTiming = (p: ShortProps): Timing => {
	const duration = p.durationSec;
	const animStart = INTRO_S;
	const animEnd = duration - OUTRO_S;
	const steps = p.steps.length;
	// Half a step of headroom so the last column is absorbed and counted up before the finale
	return {duration, animStart, animEnd, steps, stepDur: (animEnd - animStart) / (steps + 0.5 - START_S)};
};

/** Continuous step progress: column k reaches the absorb line at s = k + 1. */
export const progressAt = (t: number, tm: Timing) =>
	Math.min(tm.steps + 0.5, Math.max(START_S, START_S + (t - tm.animStart) / tm.stepDur));

/** Inverse of progressAt: the time at which step progress s is reached. */
export const timeOfS = (s: number, tm: Timing) => tm.animStart + (s - START_S) * tm.stepDur;

export const absorbTime = (k: number, tm: Timing) => timeOfS(k + 1, tm);

/** Step progress at which each entity's gain of step k is absorbed (see engine/hits.ts); default: the axis, s = k + 1. */
export type Hits = Record<string, number[]>;

export const valuesAt = (p: ShortProps, s: number, hits?: Hits): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const e of p.entities) {
		let v = 0;
		p.steps.forEach((step, k) => {
			v += (step.values[e.id] ?? 0) * easeOutCubic((s - (hits?.[e.id]?.[k] ?? k + 1)) / COUNT_UP_STEPS);
		});
		out[e.id] = v;
	}
	return out;
};

/** Discrete order: highest value first, "others" always last, ties keep input order. */
export const ranksFor = (p: ShortProps, values: Record<string, number>): Record<string, number> => {
	const order = p.entities
		.map((e, i) => ({e, i}))
		.sort((a, b) => {
			if (!!a.e.others !== !!b.e.others) return a.e.others ? 1 : -1;
			const dv = (values[b.e.id] ?? 0) - (values[a.e.id] ?? 0);
			return Math.abs(dv) > 1e-6 ? dv : a.i - b.i;
		});
	const r: Record<string, number> = {};
	order.forEach((o, idx) => (r[o.e.id] = idx));
	return r;
};

/** Smooth row slot (fractional rank) via a weighted look-back over discrete ranks — deterministic per frame. */
export const smoothRanksAt = (p: ShortProps, t: number, tm: Timing, hits?: Hits): Record<string, number> => {
	const samples = 12;
	const acc: Record<string, number> = {};
	let wsum = 0;
	for (let i = 0; i < samples; i++) {
		const back = (i / (samples - 1)) * RANK_SMOOTH_S;
		const w = 1 - i / samples;
		const r = ranksFor(p, valuesAt(p, progressAt(t - back, tm), hits));
		for (const id in r) acc[id] = (acc[id] ?? 0) + r[id] * w;
		wsum += w;
	}
	for (const id in acc) acc[id] = easeInOutSlot(acc[id] / wsum);
	return acc;
};

// Keeps slots crisp near integers so rows settle firmly between swaps
const easeInOutSlot = (x: number) => {
	const base = Math.floor(x);
	return base + easeInOutCubic(x - base);
};

export type SfxEvent = {t: number; kind: 'pop' | 'whoosh' | 'tick' | 'impact' | 'win' | 'swoosh'; entity?: string};

export const buildEvents = (p: ShortProps, fps: number, hits?: Hits): SfxEvent[] => {
	const tm = getTiming(p);
	const ev: SfxEvent[] = [{t: 0.05, kind: 'swoosh'}];
	p.steps.forEach((_, k) => ev.push({t: absorbTime(k, tm) - tm.stepDur * 0.5, kind: 'tick'}));
	// One pop per bubble hitting its bar; hits closer than 0.12 s share a pop so they don't stack into noise
	const pops = p.steps
		.flatMap((step, k) =>
			p.entities.filter((e) => (step.values[e.id] ?? 0) > 0).map((e) => timeOfS(hits?.[e.id]?.[k] ?? k + 1, tm)),
		)
		.sort((a, b) => a - b);
	let lastPop = -1;
	for (const t of pops) {
		if (t - lastPop < 0.12) continue;
		ev.push({t, kind: 'pop'});
		lastPop = t;
	}
	let prev = ranksFor(p, valuesAt(p, 0, hits));
	for (let f = 1; f < tm.animEnd * fps; f++) {
		const t = f / fps;
		const r = ranksFor(p, valuesAt(p, progressAt(t, tm), hits));
		for (const id in r) {
			if (r[id] < prev[id]) {
				const last = ev.filter((e) => e.kind === 'whoosh').pop();
				if (!last || t - last.t > 0.3) ev.push({t, kind: 'whoosh', entity: id});
				break;
			}
		}
		prev = r;
	}
	ev.push({t: tm.animEnd + 0.15, kind: 'impact'}, {t: tm.animEnd + 0.3, kind: 'win'});
	return ev.sort((a, b) => a.t - b.t);
};

export const leaderAtEnd = (p: ShortProps) => {
	const r = ranksFor(p, valuesAt(p, p.steps.length + 2));
	return Object.keys(r).find((id) => r[id] === 0)!;
};

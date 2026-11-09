import React from 'react';
import {CHART_BOTTOM, CHART_TOP, type Layout} from '../engine/layout';
import {fonts} from '../fonts';
import type {ShortProps} from '../schema';
import type {Theme} from '../theme/themes';
import type {Hits} from '../engine/timeline';
import {BallIcon, TrophyIcon} from './Icons';

const POP_STEPS = 0.07; // bubble pop length in step progress

const StepPill: React.FC<{label: string; icon: ShortProps['stepIcon']; dark: boolean}> = ({label, icon, dark}) => (
	<div
		style={{
			display: 'flex',
			alignItems: 'center',
			gap: 10,
			padding: '6px 18px 4px 10px',
			borderRadius: 999,
			background: dark ? 'rgba(12,20,70,0.85)' : 'rgba(255,255,255,0.16)',
			border: '2px solid rgba(255,255,255,0.25)',
			fontFamily: fonts.number,
			fontSize: 40,
			color: '#ffffff',
			whiteSpace: 'nowrap',
			boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
		}}
	>
		{icon === 'ball' ? <BallIcon size={34} /> : icon === 'trophy' ? <TrophyIcon size={26} /> : null}
		<span>{label}</span>
	</div>
);

const Delta: React.FC<{kind: Theme['delta']; value: number; size: number; pulse: number}> = ({kind, value, size, pulse}) => {
	const text = `+${Math.round(value)}`;
	if (kind === 'navy') {
		return (
			<div style={{width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #23358f 0%, #0c1550 80%)', border: '3px solid rgba(255,255,255,0.25)', boxShadow: `0 0 ${18 + pulse * 14}px rgba(10,20,80,0.8)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.number, fontSize: size * 0.5, color: '#ffffff'}}>
				{text}
			</div>
		);
	}
	const green = `0 0 ${22 + pulse * 22}px ${4 + pulse * 6}px rgba(61,240,74,0.75)`;
	if (kind === 'diamond') {
		return (
			<div style={{width: size, height: size, transform: 'rotate(45deg)', borderRadius: size * 0.12, background: 'linear-gradient(135deg, #7dff6b 0%, #26d93a 100%)', boxShadow: green, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
				<span style={{transform: 'rotate(-45deg)', fontFamily: fonts.number, fontSize: size * 0.48, color: '#0c4a12'}}>{text}</span>
			</div>
		);
	}
	return (
		<div style={{width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #8bff7a 0%, #2fdc3c 70%)', boxShadow: green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.number, fontSize: size * 0.5, color: '#0a5c12'}}>
			{text}
		</div>
	);
};

const GridMark: React.FC<{won: number; size: number}> = ({won, size}) => (
	<div style={{position: 'relative', width: size, height: size}}>
		<div style={{width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #8bff7a 0%, #2fdc3c 70%)', boxShadow: '0 0 16px rgba(61,240,74,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
			{won > 0 ? (
				<span style={{fontFamily: fonts.number, fontSize: size * 0.52, color: '#0a5c12'}}>+{won}</span>
			) : (
				<svg width={size * 0.55} height={size * 0.55} viewBox="0 0 10 10" aria-hidden="true">
					<path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="#e5243b" strokeWidth="2.2" strokeLinecap="round" />
				</svg>
			)}
		</div>
		{won > 0 ? (
			<div style={{position: 'absolute', left: size * 0.92, top: -size * 0.15}}>
				<TrophyIcon size={size * 0.62} />
			</div>
		) : null}
	</div>
);

export const Columns: React.FC<{
	p: ShortProps;
	theme: Theme;
	layout: Layout;
	s: number;
	rowY: Record<string, number>;
	t: number;
	hits: Hits;
}> = ({p, theme, layout, s, rowY, t, hits}) => {
	const grid = theme.delta === 'grid';
	const pillTop = CHART_TOP - 98;
	return (
		<div style={{position: 'absolute', inset: 0}}>
			{p.steps.map((step, k) => {
				const x = layout.absorbX + (k + 1 - s) * theme.columnSpacing;
				if (x > 1240) return null;
				// Like Zeynel's studio: the column (with its +N bubbles) slides in and softly fades out as it reaches the absorb line
				const dist = x - layout.absorbX;
				const enterFade = Math.min(1, (1200 - x) / 140);
				const raw = Math.max(0, Math.min(1, (dist - 6) / 110));
				const op = Math.min(enterFade, raw * raw * (3 - 2 * raw));
				if (op <= 0) return null;
				const lineColor = theme.delta === 'navy' ? 'rgba(12,22,90,0.85)' : theme.deltaTrack;
				const label = `${step.label}${p.stepSuffix}`;
				return (
					<div key={k} style={{position: 'absolute', inset: 0, opacity: op}}>
						<div
							style={{
								position: 'absolute',
								left: x - 3,
								top: CHART_TOP - 30,
								width: 6,
								height: CHART_BOTTOM - CHART_TOP + 30,
								background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${lineColor} 12%, ${lineColor} 88%, rgba(0,0,0,0) 100%)`,
								boxShadow: theme.delta === 'navy' ? 'none' : `0 0 18px 3px ${theme.deltaTrack}`,
								opacity: grid ? 0.6 : 0.9,
							}}
						/>
						<div style={{position: 'absolute', left: x, top: pillTop, transform: 'translateX(-50%)'}}>
							<StepPill label={label} icon={p.stepIcon} dark={theme.delta !== 'grid'} />
						</div>
						{theme.delta === 'none' || !p.showDeltas
							? null
							: p.entities.map((e) => {
									if (e.others && !grid) return null;
									const v = step.values[e.id] ?? 0;
									if (!grid && v <= 0) return null;
									// A gain bubble bursts on the face it lands on: quick swell + fade, then it's in the total
									const popK = v > 0 && !e.others ? (s - hits[e.id][k]) / POP_STEPS : -1;
									if (popK >= 1) return null;
									const pop = popK > 0 ? {transform: `scale(${1 + popK * 0.6})`, opacity: 1 - popK} : undefined;
									const size = grid ? layout.deltaSize * 0.9 : layout.deltaSize;
									const y = rowY[e.id];
									if (grid) {
										return (
											<div key={e.id} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, ...pop}}>
												<GridMark won={v} size={size} />
											</div>
										);
									}
									const pulse = 0.5 + 0.5 * Math.sin(t * 8 + k);
									return (
										<div key={e.id} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, ...pop}}>
											<Delta kind={theme.delta} value={v} size={size} pulse={pulse} />
										</div>
									);
							  })}
					</div>
				);
			})}
		</div>
	);
};

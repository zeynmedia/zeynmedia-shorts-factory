import React from 'react';
import {easeOutCubic} from '../engine/timeline';
import {fonts} from '../fonts';
import type {Theme} from '../theme/themes';

const HOLD_S = 1.0;
const OUT_S = 0.3;

/** First-second question over the chart: gives the swipe-or-stay decision a reason to stay. */
export const Hook: React.FC<{text: string; t: number; theme: Theme}> = ({text, t, theme}) => {
	if (t > HOLD_S + OUT_S) return null;
	const pop = t < 0.18 ? 1.18 - 0.18 * easeOutCubic(t / 0.18) : 1 + 0.02 * Math.sin(t * 14);
	const out = easeOutCubic((t - HOLD_S) / OUT_S);
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: 318, // under the title, over the step pills: never covers a face
				display: 'flex',
				justifyContent: 'center',
				transform: `translateY(${-out * 60}px) scale(${pop * (1 - out * 0.4)})`,
				opacity: 1 - out,
			}}
		>
			<div
				style={{
					padding: '18px 48px 12px',
					borderRadius: 28,
					background: 'linear-gradient(180deg, #ffe45c 0%, #ffb800 100%)',
					boxShadow: `0 0 50px 8px ${theme.glow}, 0 14px 30px rgba(0,0,0,0.45)`,
					border: '5px solid #ffffff',
					transform: 'rotate(-3deg)',
					fontFamily: fonts.title,
					fontWeight: 900,
					fontStyle: 'italic',
					fontSize: Math.min(88, Math.floor(1480 / Math.max(1, text.length))), // longer custom hooks shrink to fit
					lineHeight: 1,
					letterSpacing: 1,
					color: '#1a1300',
					whiteSpace: 'nowrap',
				}}
			>
				{text}
			</div>
		</div>
	);
};

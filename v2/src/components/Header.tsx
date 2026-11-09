import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOutCubic} from '../engine/timeline';
import {fonts} from '../fonts';
import type {Theme} from '../theme/themes';

export const Header: React.FC<{title: string; subtitle: string; theme: Theme}> = ({title, subtitle, theme}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	// Readable on frame 0 (the feed preview), with a short punch-in
	const enter = easeOutCubic(0.55 + t / 0.3);
	// Light sweep across the title every 4 seconds
	const sweep = ((t % 4) / 0.9) * 140 - 20;
	// One line always: long three-way titles shrink instead of wrapping into the hook badge
	const titleSize = Math.min(80, Math.floor(1550 / Math.max(1, title.length)));

	return (
		<div
			style={{
				position: 'absolute',
				top: 210,
				left: 40,
				right: 40,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 14,
				transform: `scale(${interpolate(enter, [0, 1], [1.25, 1])})`,
				opacity: enter,
				filter: `blur(${(1 - enter) * 8}px)`,
			}}
		>
			<div
				style={{
					fontFamily: fonts.title,
					fontWeight: 800,
					fontSize: titleSize,
					whiteSpace: 'nowrap',
					lineHeight: 1.02,
					textAlign: 'center',
					textTransform: 'uppercase',
					color: 'transparent',
					backgroundImage: `linear-gradient(100deg, #ffffff ${sweep - 12}%, #fffbe0 ${sweep}%, #ffffff ${sweep + 12}%)`,
					WebkitBackgroundClip: 'text',
					backgroundClip: 'text',
					filter: `drop-shadow(0 0 18px ${theme.glow}) drop-shadow(0 4px 6px rgba(0,0,0,0.25))`,
				}}
			>
				{title}
			</div>
			{theme.subtitleStyle === 'yellow' ? (
				<div
					style={{
						fontFamily: fonts.title,
						fontWeight: 900,
						fontSize: 40,
						letterSpacing: 5,
						color: '#f4ea5a',
						textTransform: 'uppercase',
						textShadow: '0 0 14px rgba(244,234,90,0.45)',
					}}
				>
					{subtitle}
				</div>
			) : (
				<div
					style={{
						fontFamily: fonts.title,
						fontWeight: 800,
						fontSize: 38,
						letterSpacing: 1.5,
						color: '#ffffff',
						textTransform: 'uppercase',
						background: theme.subtitleBox,
						padding: theme.subtitleBox === 'transparent' ? 0 : '6px 22px',
					}}
				>
					{subtitle}
				</div>
			)}
		</div>
	);
};

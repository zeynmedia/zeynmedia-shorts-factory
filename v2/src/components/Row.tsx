import React from 'react';
import {Img} from 'remotion';
import {asset} from '../asset';
import type {Layout} from '../engine/layout';
import {fonts} from '../fonts';
import type {Entity} from '../schema';
import type {Theme} from '../theme/themes';
import {Portrait} from './Portrait';

export type RowFx = {
	flash: number; // 0..1 white flash on the box after a gain
	punch: number; // extra scale on gain / overtake
	winner: number; // 0..1 gold finale highlight
	enter: number; // 0..1 intro slide-in
};

const VerticalName: React.FC<{name: string; size: number; color: string}> = ({name, size, color}) => (
	<span
		style={{
			writingMode: 'vertical-rl',
			fontFamily: fonts.number,
			fontSize: size,
			letterSpacing: 2,
			color,
			whiteSpace: 'nowrap',
			lineHeight: 1,
		}}
	>
		{name.toUpperCase()}
	</span>
);

export const Row: React.FC<{
	entity: Entity;
	index: number;
	theme: Theme;
	layout: Layout;
	y: number;
	boxW: number;
	appear: number; // 0 before the first gain: no empty box, just flag, name and face waiting at the axis
	label: string;
	fx: RowFx;
}> = ({entity, index, theme, layout, y, boxW, appear, label, fx}) => {
	const {axisX, boxH, tagW, portrait: P} = layout;
	const alt = index % 2 === 1;
	const boxBg =
		theme.box === 'entity' ? entity.color : theme.box === 'alt' ? (alt ? theme.boxAltColor : theme.boxColor) : theme.boxColor;
	const numColor = theme.box === 'alt' && alt ? theme.numberAlt : theme.number;
	const boxLeft = axisX + 3;
	const boxRight = boxLeft + boxW;
	const tagRight = theme.tagSide === 'right' ? boxRight + tagW : boxRight;
	const portraitLeft = theme.portrait === 'logo' ? boxRight + 6 : tagRight - P * (theme.box === 'entity' ? 0.08 : 0.03);
	const slide = (1 - fx.enter) * -700;
	const nameText = entity.others ? 'OTHERS' : entity.name;
	const fontSize = Math.min(boxH * (label.length > 4 ? 0.62 : 0.78), (boxW * 0.86) / (label.length * 0.5));
	const gold = fx.winner;

	return (
		<div style={{position: 'absolute', left: 0, top: y - boxH / 2, width: 1080, height: boxH, transform: `translateX(${slide}px)`}}>
			{/* name outside left (Goals Per Year) or left name strip (Diamond / Grid) */}
			{theme.tagSide === 'outside' ? (
				<div style={{position: 'absolute', left: 30, top: 0, height: boxH, display: 'flex', alignItems: 'center'}}>
					<VerticalName name={nameText} size={Math.min(40, boxH * 0.3)} color="#ffffff" />
				</div>
			) : null}
			{theme.tagSide === 'left' ? (
				<div
					style={{
						position: 'absolute',
						left: axisX - tagW - 12,
						top: boxH * 0.08,
						width: tagW,
						height: boxH * 0.84,
						background: theme.tag,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						transform: 'rotate(180deg)',
					}}
				>
					<VerticalName name={nameText} size={Math.min(38, tagW * 0.72)} color={theme.tagText} />
				</div>
			) : null}
			{theme.flags === 'left' && entity.flag ? (
				<div
					style={{
						position: 'absolute',
						left: layout.flagX - 36,
						top: boxH / 2 - 27,
						width: 72,
						height: 54,
						borderRadius: 12,
						overflow: 'hidden',
						border: '4px solid #ffffff',
						boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
						background: '#ffffff',
					}}
				>
					<Img src={asset(entity.flag)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
				</div>
			) : null}

			{/* value box */}
			<div
				style={{
					position: 'absolute',
					left: boxLeft,
					top: 0,
					width: boxW,
					height: boxH,
					background: boxBg,
					transform: `scale(${1 + fx.punch})`,
					transformOrigin: 'left center',
					opacity: appear,
					boxShadow: gold
						? `0 0 ${40 * gold}px ${10 * gold}px rgba(255,205,60,${0.8 * gold}), inset 0 0 0 ${6 * gold}px rgba(255,214,90,${gold})`
						: '0 10px 24px rgba(0,0,0,0.35)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: theme.box === 'entity' ? 'flex-end' : 'center',
					paddingRight: theme.box === 'entity' ? 26 : 0,
					boxSizing: 'border-box',
					overflow: 'hidden',
				}}
			>
				{theme.box === 'white' ? (
					<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(120,140,200,0.18) 100%)'}} />
				) : (
					<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.14) 100%)'}} />
				)}
				<span
					style={{
						position: 'relative',
						fontFamily: fonts.number,
						fontSize,
						lineHeight: 1,
						paddingTop: fontSize * 0.08,
						color: numColor,
						textShadow: theme.box === 'white' ? 'none' : '0 3px 0 rgba(0,0,0,0.18)',
					}}
				>
					{label}
				</span>
				<div style={{position: 'absolute', inset: 0, background: '#ffffff', opacity: fx.flash * 0.75, mixBlendMode: 'screen'}} />
			</div>

			{/* name strip right of the box */}
			{theme.tagSide === 'right' ? (
				<div
					style={{
						position: 'absolute',
						left: boxRight,
						top: 0,
						width: tagW,
						height: boxH,
						background: theme.tag,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<VerticalName name={nameText} size={Math.min(32, tagW * 0.6)} color={theme.tagText} />
				</div>
			) : null}

			{entity.others ? null : (
				<div
					style={{
						position: 'absolute',
						left: portraitLeft,
						top: boxH / 2 - P / 2,
						transform: `scale(${1 + fx.punch * 1.4})`,
					}}
				>
					<Portrait entity={entity} theme={theme} size={P} ring={theme.box === 'entity' ? entity.color : '#1b2c8f'} pulse={Math.max(fx.flash, gold)} />
				</div>
			)}
		</div>
	);
};

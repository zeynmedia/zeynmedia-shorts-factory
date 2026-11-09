import {z} from 'zod';

export const templateIds = ['bar', 'navy', 'box', 'diamond', 'grid'] as const;
export type TemplateId = (typeof templateIds)[number];

export const entitySchema = z.object({
	id: z.string(),
	name: z.string(),
	color: z.string().default('#2563eb'),
	image: z.string().optional(),
	flag: z.string().optional(),
	badge: z.string().optional(),
	others: z.boolean().optional(),
});

export const stepSchema = z.object({
	label: z.string(),
	values: z.record(z.string(), z.number()),
});

export const shortSchema = z.object({
	template: z.enum(templateIds),
	title: z.string(),
	subtitle: z.string(),
	stepIcon: z.enum(['ball', 'trophy', 'none']).default('ball'),
	stepSuffix: z.string().default(''),
	lang: z.string().default('en'), // text-transform: uppercase follows it (Turkish i -> İ)
	hook: z.string().default(''), // first-second question over the chart; empty = WHO WINS? / WHO'S #1?
	valueFormat: z.enum(['int', 'compact']).default('int'),
	brand: z.string().default('ZEYN MEDYA'),
	showDeltas: z.boolean().default(true),
	entities: z.array(entitySchema).min(2).max(8),
	steps: z.array(stepSchema).min(2),
	music: z.string().optional(),
	musicStart: z.number().default(0),
	musicVolume: z.number().min(0).max(1).default(0.7),
	sfx: z.boolean().default(true),
	sfxVolume: z.number().min(0).max(1).default(0.8),
	durationSec: z.number().min(8).max(60).default(18),
});

export type ShortProps = z.infer<typeof shortSchema>;
export type Entity = z.infer<typeof entitySchema>;

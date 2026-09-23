// Social preview images (1200x630 PNG) for link shares on Facebook, X,
// iMessage, etc. Rendered at build time with Satori, using the fonts in
// src/og-assets/, so the output is identical on every machine.
//
// Layout rule: Facebook's mobile composer and some feeds crop link images
// to roughly 1.2:1 -- only the middle ~720px of the width survives. So all
// text sits in a centered column narrower than that; only background and
// decoration run to the edges.
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';
import { CHURCH } from '../consts';

const asset = (name: string) => readFileSync(`src/og-assets/${name}`);
const fonts = [
	{ name: 'Libre Baskerville', data: asset('LibreBaskerville-Bold.woff'), weight: 700 as const, style: 'normal' as const },
	{ name: 'Libre Baskerville', data: asset('LibreBaskerville-Italic.woff'), weight: 400 as const, style: 'italic' as const },
	{ name: 'Source Sans 3', data: asset('SourceSans3-SemiBold.woff'), weight: 600 as const, style: 'normal' as const },
];
const MARK = `data:image/png;base64,${asset('mark.png').toString('base64')}`;

const NAVY = '#064060';
const CREAM = '#f8dfaf';
const RED = '#8a1515';
const SAFE_WIDTH = 700;

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
	type,
	props: { style, children, ...extra },
});

export interface OgContent {
	/** Main line: the article title (or the site name for the default card). */
	title: string;
	/** Small line under the title, e.g. "Weekly Bible Hour · September 6, 2026". */
	meta?: string;
	/** Italic line, e.g. "Matthew 6:9". */
	passage?: string;
}

function titleSize(title: string): number {
	if (title.length <= 40) return 58;
	if (title.length <= 70) return 50;
	if (title.length <= 100) return 44;
	return 38;
}

export async function renderOg({ title, meta, passage }: OgContent): Promise<Buffer> {
	const size = titleSize(title);
	const tree = h(
		'div',
		{
			width: 1200,
			height: 630,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			position: 'relative',
			backgroundColor: NAVY,
			backgroundImage: 'linear-gradient(135deg, #0b5680 0%, #064060 48%, #032a40 100%)',
		},
		[
			// Faint mark, large, off to both sides (decoration; fine if cropped)
			h('img', { position: 'absolute', left: -120, top: 95, width: 440, height: 440, opacity: 0.06 }, undefined, { src: MARK }),
			h('img', { position: 'absolute', right: -120, top: 95, width: 440, height: 440, opacity: 0.06 }, undefined, { src: MARK }),
			// Thin cream frame
			h('div', {
				position: 'absolute', left: 22, top: 22, width: 1156, height: 576,
				border: '2px solid rgba(248, 223, 175, 0.30)', borderRadius: 6,
			}),
			// Red base bar
			h('div', { position: 'absolute', left: 0, bottom: 0, width: 1200, height: 14, backgroundColor: RED }),
			// Content column (safe zone)
			h(
				'div',
				{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: SAFE_WIDTH, textAlign: 'center' },
				[
					h('img', { width: 70, height: 68 }, undefined, { src: MARK }),
					h('div', {
						marginTop: 12, fontFamily: 'Source Sans 3', fontWeight: 600, fontSize: 19,
						letterSpacing: 5, color: CREAM, textTransform: 'uppercase',
					}, CHURCH.name),
					h('div', { marginTop: 20, width: 56, height: 2, backgroundColor: 'rgba(248, 223, 175, 0.55)' }),
					h('div', {
						marginTop: 26, fontFamily: 'Libre Baskerville', fontWeight: 700, fontSize: size,
						lineHeight: 1.22, color: '#ffffff', lineClamp: 4, display: 'block',
					}, title),
					...(meta
						? [h('div', {
							marginTop: 28, fontFamily: 'Source Sans 3', fontWeight: 600, fontSize: 25,
							color: CREAM, letterSpacing: 0.5,
						}, meta)]
						: []),
					...(passage
						? [h('div', {
							marginTop: 8, fontFamily: 'Libre Baskerville', fontStyle: 'italic', fontSize: 23,
							color: '#dfe7ee',
						}, passage)]
						: []),
				],
			),
		],
	);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const svg = await satori(tree as any, { width: 1200, height: 630, fonts });
	return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

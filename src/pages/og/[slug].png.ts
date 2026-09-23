// Per-article social preview image (1200x630), rendered at build time so a
// shared link shows that article's title instead of a generic card.
import { readFileSync } from 'node:fs';
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { CHURCH } from '../../consts';
import { formatDate, getPosts, type Post } from '../../lib/posts';

export const getStaticPaths = (async () => {
	const posts = await getPosts();
	return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

const LOGO = readFileSync('public/logo.png').toString('base64');
const SERIF = "'Liberation Serif', Georgia, 'Times New Roman', 'DejaVu Serif', serif";
const SANS = "'Liberation Sans', 'Segoe UI', Arial, 'DejaVu Sans', sans-serif";

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap by character count (good enough for a serif headline). */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/)) {
		if ((line + ' ' + word).trim().length > maxChars && line) {
			lines.push(line);
			line = word;
		} else {
			line = (line + ' ' + word).trim();
		}
	}
	if (line) lines.push(line);
	if (lines.length > maxLines) {
		lines.length = maxLines;
		lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '…';
	}
	return lines;
}

export const GET: APIRoute = async ({ props }) => {
	const { post } = props as { post: Post };
	const d = post.data;
	const long = d.title.length > 60;
	const size = long ? 54 : 64;
	const lines = wrap(d.title, long ? 36 : 30, 4);
	const lineHeight = size * 1.18;
	const titleTop = 330 - ((lines.length - 1) * lineHeight) / 2;
	const meta = [d.service, formatDate(d.pubDate)].filter(Boolean).join('  ·  ');

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
	<rect width="1200" height="630" fill="#064060"/>
	<rect y="600" width="1200" height="30" fill="#801010"/>
	<image x="80" y="52" width="495" height="68" href="data:image/png;base64,${LOGO}"/>
	${lines
		.map(
			(l, i) =>
				`<text x="80" y="${titleTop + i * lineHeight}" font-family="${SERIF}" font-size="${size}" font-weight="700" fill="#ffffff">${esc(l)}</text>`,
		)
		.join('\n\t')}
	<text x="80" y="520" font-family="${SANS}" font-size="28" fill="#f8dfaf">${esc(meta)}</text>
	${
		d.primaryPassage
			? `<text x="80" y="562" font-family="${SERIF}" font-size="28" font-style="italic" fill="#dfe7ee">${esc(d.primaryPassage)} (KJV)</text>`
			: `<text x="80" y="562" font-family="${SANS}" font-size="24" fill="#dfe7ee">${esc(CHURCH.name)}</text>`
	}
</svg>`;

	const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};

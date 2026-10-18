// Feed readers (Subsplash's article import, podcast apps, RSS readers) show
// a post's content:encoded HTML on someone else's page, so it has to stand on
// its own: every link and image absolute, nothing that could run script or
// depend on this site's CSS. Used only by src/lib/feed.ts; the site's own
// pages render Markdown with Astro's normal pipeline.
//
// Allowlist, not blocklist: elements outside TAGS are unwrapped (their text
// kept), anything in DROP is removed with its contents, and only the
// attributes in ATTRS survive.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const TAGS = new Set([
	'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li',
	'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sup', 'sub', 'small', 'mark', 'abbr',
	'cite', 'q', 'code', 'pre', 'a', 'img', 'figure', 'figcaption', 'table', 'thead',
	'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'dl', 'dt', 'dd',
]);
const DROP = new Set([
	'script', 'style', 'noscript', 'template', 'iframe', 'frame', 'object', 'embed', 'form',
	'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'svg', 'math',
]);
const ATTRS = {
	a: ['href', 'title'],
	img: ['src', 'alt', 'title', 'width', 'height'],
	ol: ['start'],
	th: ['align'],
	td: ['align'],
	abbr: ['title'],
};
const LINK_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:']);
const IMAGE_SCHEMES = new Set(['https:', 'http:']);

/**
 * @param {{ base: string, publicDir: string }} options
 *   base: the post's absolute permalink, which relative URLs resolve against
 *   (as a browser on the post page would). publicDir: where root-relative
 *   images on this site must exist.
 */
export default function rehypeFeedHtml({ base, publicDir }) {
	const baseUrl = new URL(base);

	/** Absolute URL for an href/src, or undefined to drop it. */
	function absolute(value, tag) {
		let url;
		try {
			url = new URL(String(value), baseUrl);
		} catch {
			return undefined;
		}
		if (!(tag === 'img' ? IMAGE_SCHEMES : LINK_SCHEMES).has(url.protocol)) return undefined;
		// Only expose images that are really there: a same-site image must be a
		// file in public/. Images next to the Markdown file are optimized by
		// Astro to hashed /_astro/ URLs this renderer can't know, so fail the
		// build rather than ship a broken image to Subsplash.
		if (tag === 'img' && url.origin === baseUrl.origin) {
			const file = join(publicDir, decodeURIComponent(url.pathname));
			if (!existsSync(file)) {
				throw new Error(
					`[feed] Image "${value}" in ${base} is not a file in public/. ` +
						'Use a root-relative path to a file in public/ (e.g. /images/x.jpg) or an absolute URL.',
				);
			}
		}
		return url.href;
	}

	function clean(parent) {
		parent.children = parent.children.flatMap((node) => {
			if (node.type === 'text') return [node];
			if (node.type !== 'element' || DROP.has(node.tagName)) return []; // raw HTML, comments
			clean(node);
			if (!TAGS.has(node.tagName)) return node.children;

			const keep = ATTRS[node.tagName] ?? [];
			const props = {};
			for (const [key, value] of Object.entries(node.properties ?? {})) {
				if (keep.includes(key)) props[key] = value;
			}
			for (const key of ['href', 'src']) {
				if (key in props) {
					const url = absolute(props[key], node.tagName);
					if (url) props[key] = url;
					else delete props[key];
				}
			}
			node.properties = props;

			if (node.tagName === 'a' && !props.href) return node.children;
			if (node.tagName === 'img' && !props.src) return [];
			return [node];
		});
	}

	return (tree) => clean(tree);
}

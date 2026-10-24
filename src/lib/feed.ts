import { resolve } from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { type Post, postUrl } from './posts';
import rehypeFeedHtml from './rehype-feed-html.mjs';
import remarkStripLeadingH1 from './remark-strip-leading-h1.mjs';

/**
 * A post's full body as standalone HTML for the feed's content:encoded.
 *
 * Same Markdown dialect as the post page (Astro's defaults -- GFM and
 * SmartyPants -- plus the remark plugins in astro.config.mjs; keep the two in
 * sync), then made portable by rehype-feed-html. Raw HTML in the Markdown is
 * dropped rather than passed through to other sites.
 */
export async function feedHtml(post: Post, site: URL): Promise<string> {
	const processor = await createMarkdownProcessor({
		remarkPlugins: [remarkStripLeadingH1],
		rehypePlugins: [
			[rehypeFeedHtml, { base: new URL(postUrl(post), site).href, publicDir: resolve('public') }],
		],
		remarkRehype: { allowDangerousHtml: false },
		syntaxHighlight: false,
	});
	const { code } = await processor.render(post.body ?? '');
	return code.trim();
}

/** Escape text for an XML element written by hand into `customData`. */
export const xmlText = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
export const MEDIA_NAMESPACE = 'http://search.yahoo.com/mrss/';

/**
 * The post's social preview card (src/pages/og/[slug].png.ts, built for every
 * post) as the feed item's image, so Subsplash shows the same picture as a
 * Facebook or iMessage share.
 */
export const feedImage = (post: Post, site: URL) =>
	`<media:content url="${new URL(`/og/${post.id}.png`, site).href}" medium="image" type="image/png" width="1200" height="630"/>`;

/**
 * Feed-only link with UTM tags, so a tap-through from the app shows up in
 * Google Analytics as source "app" / medium "rss". The item's guid must stay
 * the clean permalink (see feedGuid), or readers would treat every post as new.
 */
export const feedLink = (post: Post, site: URL) => {
	const url = new URL(postUrl(post), site);
	url.search = 'utm_source=app&utm_medium=rss&utm_campaign=feed';
	return url.href;
};

/** The clean permalink as the item's guid, overriding the one derived from link. */
export const feedGuid = (post: Post, site: URL) =>
	`<guid isPermaLink="true">${new URL(postUrl(post), site).href}</guid>`;

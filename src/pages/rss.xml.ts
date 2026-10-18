import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { DC_NAMESPACE, feedHtml, xmlText } from '../lib/feed';
import { getPosts, postUrl } from '../lib/posts';

// Subsplash imports articles from this feed: `description` stays the short
// SEO summary, the full article goes in content:encoded, and the preacher is
// dc:creator (RSS <author> must be an email address). Checked after every
// build by scripts/check-feed.mjs.
export async function GET(context: APIContext) {
	const site = context.site!;
	const posts = (await getPosts()).filter((p) => !p.isDraft);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site,
		xmlns: { dc: DC_NAMESPACE },
		items: await Promise.all(
			posts.map(async (post) => ({
				title: post.data.title,
				description: post.data.description,
				pubDate: post.data.pubDate,
				link: postUrl(post),
				content: await feedHtml(post, site),
				customData: post.data.preacher
					? `<dc:creator>${xmlText(post.data.preacher)}</dc:creator>`
					: undefined,
				categories: [post.data.service, post.data.primaryPassage, ...post.data.tags].filter(
					Boolean,
				) as string[],
			})),
		),
		customData: '<language>en-us</language>',
	});
}

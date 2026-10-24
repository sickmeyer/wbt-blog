import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { DC_NAMESPACE, feedGuid, feedHtml, feedImage, feedLink, MEDIA_NAMESPACE, xmlText } from '../lib/feed';
import { getPosts, postUrl } from '../lib/posts';

// Subsplash imports articles from this feed: `description` stays the short
// SEO summary, the full article goes in content:encoded, and the preacher is
// dc:creator (RSS <author> must be an email address), and the post's social
// card is its media:content image. Checked after every
// build by scripts/check-feed.mjs.
export async function GET(context: APIContext) {
	const site = context.site!;
	const posts = (await getPosts()).filter((p) => !p.isDraft);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site,
		xmlns: { dc: DC_NAMESPACE, media: MEDIA_NAMESPACE },
		items: await Promise.all(
			posts.map(async (post) => ({
				title: post.data.title,
				description: post.data.description,
				pubDate: post.data.pubDate,
				link: feedLink(post, site),
				content: await feedHtml(post, site),
				customData:
					(post.data.preacher ? `<dc:creator>${xmlText(post.data.preacher)}</dc:creator>` : '') +
					feedImage(post, site) +
					feedGuid(post, site),
				categories: [post.data.service, post.data.primaryPassage, ...post.data.tags].filter(
					Boolean,
				) as string[],
			})),
		),
		customData: '<language>en-us</language>',
	});
}

import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { feedGuid, feedLink } from '../../lib/feed';
import { t } from '../../lib/i18n';
import { getPosts } from '../../lib/posts';

export async function GET(context: APIContext) {
	const site = context.site!;
	const tr = t('es');
	const posts = (await getPosts('es')).filter((p) => !p.isDraft);
	return rss({
		title: tr.rssTitle,
		description: tr.rssDescription,
		site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: feedLink(post, site),
			customData: feedGuid(post, site),
			author: post.data.preacher,
			categories: [post.data.service, post.data.primaryPassage, ...post.data.tags].filter(
				Boolean,
			) as string[],
		})),
		customData: '<language>es-us</language>',
	});
}

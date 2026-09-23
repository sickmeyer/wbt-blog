import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { t } from '../../lib/i18n';
import { getPosts, postUrl } from '../../lib/posts';

export async function GET(context: APIContext) {
	const tr = t('es');
	const posts = (await getPosts('es')).filter((p) => !p.isDraft);
	return rss({
		title: tr.rssTitle,
		description: tr.rssDescription,
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: postUrl(post),
			author: post.data.preacher,
			categories: [post.data.service, post.data.primaryPassage, ...post.data.tags].filter(
				Boolean,
			) as string[],
		})),
		customData: '<language>es-us</language>',
	});
}

import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPosts, postUrl } from '../lib/posts';

export async function GET(context: APIContext) {
	const posts = (await getPosts()).filter((p) => !p.isDraft);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
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
		customData: '<language>en-us</language>',
	});
}

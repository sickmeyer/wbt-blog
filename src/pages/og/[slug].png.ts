// Per-article social preview image, rendered at build time (src/lib/og.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { formatDate, getPosts, type Post } from '../../lib/posts';
import { renderOg } from '../../lib/og';

export const getStaticPaths = (async () => {
	const posts = await getPosts();
	return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { post } = props as { post: Post };
	const d = post.data;
	const png = await renderOg({
		title: d.title,
		meta: [d.service, formatDate(d.pubDate)].filter(Boolean).join('  ·  '),
		passage: d.primaryPassage,
	});
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};

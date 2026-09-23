// getStaticPaths bodies shared by the English routes and the /es/ routes.
import type { Lang } from './i18n';
import { BOOKS, bookSlug, booksOf, getPosts, type Post, slugify } from './posts';

export async function postPaths(lang: Lang) {
	const posts = await getPosts(lang);
	return posts.map((post, i) => ({
		params: { slug: post.id },
		// posts are newest-first: index-1 is newer, index+1 is older
		props: { post, newer: posts[i - 1], older: posts[i + 1] },
	}));
}

export async function bookPaths(lang: Lang) {
	const posts = await getPosts(lang);
	return BOOKS.map((book) => ({
		params: { book: bookSlug(book, lang) },
		props: { book, lang, posts: posts.filter((p) => booksOf(p).includes(book)) },
	})).filter((p) => p.props.posts.length > 0);
}

// One page per service (Sunday Main Worship, Servicio en Español, ...).
export async function servicePaths(lang: Lang) {
	const byService = new Map<string, Post[]>();
	for (const post of await getPosts(lang)) {
		const s = post.data.service;
		if (s) byService.set(s, [...(byService.get(s) ?? []), post]);
	}
	return [...byService].map(([service, posts]) => ({
		params: { service: slugify(service) },
		props: { service, lang, posts },
	}));
}

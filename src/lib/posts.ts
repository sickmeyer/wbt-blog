import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = (CollectionEntry<'posts'> | CollectionEntry<'drafts'>) & { isDraft: boolean };

// Drafts appear in `npm run dev`, or in a build with INCLUDE_DRAFTS=true
// (`npm run build:drafts`, for testing locally -- never deploy that build).
const showDrafts = import.meta.env.DEV || process.env.INCLUDE_DRAFTS === 'true';

/** Published posts, plus drafts when previewing. Newest first. */
export async function getPosts(): Promise<Post[]> {
	const published = (await getCollection('posts')).map((p) => ({ ...p, isDraft: false }));
	const drafts = showDrafts
		? (await getCollection('drafts')).map((p) => ({ ...p, isDraft: true }))
		: [];
	return [...published, ...drafts].sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
}

export const postUrl = (post: Post) => `/posts/${post.id}/`;

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Dates are calendar days (the service date), so always format in UTC. */
export function formatDate(date: Date, style: 'long' | 'short' = 'long'): string {
	return date.toLocaleDateString('en-US', {
		timeZone: 'UTC',
		year: 'numeric',
		month: style === 'long' ? 'long' : 'short',
		day: 'numeric',
	});
}

export function readingMinutes(body: string | undefined): number {
	const words = (body ?? '').split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 230));
}

// ---- Scripture ----

export const BOOKS = [
	'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
	'1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
	'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
	'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
	'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
	'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
	'2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
	'2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
	'1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];
const OLD_TESTAMENT_BOOKS = 39;
const BOOK_BY_LOWER = new Map(BOOKS.map((b) => [b.toLowerCase(), b]));
BOOK_BY_LOWER.set('psalm', 'Psalms');
BOOK_BY_LOWER.set('song of songs', 'Song of Solomon');
BOOK_BY_LOWER.set('revelations', 'Revelation');

/** "1 Corinthians 2:13" -> "1 Corinthians"; undefined if it isn't a reference. */
export function bookOf(reference: string): string | undefined {
	const m = reference.trim().match(/^(.+?)\s+\d+(?::|$|\s)/);
	return m ? BOOK_BY_LOWER.get(m[1].toLowerCase()) : undefined;
}

export const bookIndex = (book: string) => BOOKS.indexOf(book);
export const isOldTestament = (book: string) => bookIndex(book) < OLD_TESTAMENT_BOOKS;

/** Every book a post cites, primary passage first. */
export function booksOf(post: Post): string[] {
	const refs = [post.data.primaryPassage, ...post.data.scripture].filter(Boolean) as string[];
	return [...new Set(refs.map(bookOf).filter(Boolean) as string[])];
}

export const kjvLink = (reference: string) =>
	`https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=KJV`;

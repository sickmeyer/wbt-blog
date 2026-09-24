import { type CollectionEntry, getCollection } from 'astro:content';
import { type Lang, langPrefix, t } from './i18n';

export type Post = (CollectionEntry<'posts'> | CollectionEntry<'drafts'>) & { isDraft: boolean };

// Drafts appear in `npm run dev`, or in a build with INCLUDE_DRAFTS=true
// (`npm run build:drafts`, for testing locally -- never deploy that build).
const showDrafts = import.meta.env.DEV || process.env.INCLUDE_DRAFTS === 'true';

/** Published posts in one language, plus drafts when previewing. Newest first. */
export async function getPosts(lang: Lang = 'en'): Promise<Post[]> {
	const published = (await getCollection('posts')).map((p) => ({ ...p, isDraft: false }));
	const drafts = showDrafts
		? (await getCollection('drafts')).map((p) => ({ ...p, isDraft: true }))
		: [];
	return [...published, ...drafts]
		.filter((p) => p.data.lang === lang)
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export const postUrl = (post: Post) => `${langPrefix(post.data.lang)}/posts/${post.id}/`;

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Dates are calendar days (the service date), so always format in UTC. */
export function formatDate(date: Date, style: 'long' | 'short' = 'long', lang: Lang = 'en'): string {
	return date.toLocaleDateString(t(lang).locale, {
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

/** Canonical (English) book names -- the keys used everywhere internally. */
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
/** Reina Valera names, aligned with BOOKS. */
export const SPANISH_BOOKS = [
	'Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut',
	'1 Samuel', '2 Samuel', '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras',
	'Nehemías', 'Ester', 'Job', 'Salmos', 'Proverbios', 'Eclesiastés', 'Cantares',
	'Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amós',
	'Abdías', 'Jonás', 'Miqueas', 'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías',
	'Malaquías', 'Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos', 'Romanos', '1 Corintios',
	'2 Corintios', 'Gálatas', 'Efesios', 'Filipenses', 'Colosenses', '1 Tesalonicenses',
	'2 Tesalonicenses', '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón', 'Hebreos', 'Santiago',
	'1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan', 'Judas', 'Apocalipsis',
];
const OLD_TESTAMENT_BOOKS = 39;

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
const BOOK_BY_NAME = new Map<string, string>();
BOOKS.forEach((b, i) => {
	BOOK_BY_NAME.set(fold(b), b);
	BOOK_BY_NAME.set(fold(SPANISH_BOOKS[i]), b);
});
for (const [alias, book] of [
	['psalm', 'Psalms'], ['song of songs', 'Song of Solomon'], ['revelations', 'Revelation'],
	['salmo', 'Psalms'], ['cantar de los cantares', 'Song of Solomon'],
]) BOOK_BY_NAME.set(alias, book);

/** "1 Corintios 2:13" or "1 Corinthians 2:13" -> "1 Corinthians"; undefined if not a reference. */
export function bookOf(reference: string): string | undefined {
	const m = reference.trim().match(/^(.+?)\s+\d+(?::|$|\s)/);
	return m ? BOOK_BY_NAME.get(fold(m[1])) : undefined;
}

/** A canonical book's display name in a language. */
export const bookName = (book: string, lang: Lang) =>
	lang === 'es' ? SPANISH_BOOKS[BOOKS.indexOf(book)] ?? book : book;

export const bookSlug = (book: string, lang: Lang) => slugify(bookName(book, lang));

export const bookIndex = (book: string) => BOOKS.indexOf(book);
export const isOldTestament = (book: string) => bookIndex(book) < OLD_TESTAMENT_BOOKS;

/** Every book a post cites, primary passage first. */
export function booksOf(post: Post): string[] {
	const refs = [post.data.primaryPassage, ...post.data.scripture].filter(Boolean) as string[];
	return [...new Set(refs.map(bookOf).filter(Boolean) as string[])];
}

/** Link to the verse text on BibleGateway: KJV, or the Reina-Valera 1960 for Spanish posts. */
export function verseLink(reference: string, lang: Lang = 'en'): string {
	let search = reference;
	if (lang === 'es') {
		// BibleGateway parses English book names reliably; the chapter/verse part is the same.
		const book = bookOf(reference);
		const tail = reference.trim().match(/\s(\d.*)$/);
		if (book && tail) search = `${book} ${tail[1]}`;
	}
	const version = lang === 'es' ? 'RVR1960' : 'KJV';
	return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${version}`;
}

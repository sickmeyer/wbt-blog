#!/usr/bin/env node
// Regression checks for the built English feed (dist/rss.xml), which
// Subsplash imports articles from. Run after `npm run build`:
//
//   npm run check:feed
//
// Compares the feed against the Markdown sources so a change that breaks the
// feed -- invalid XML, a missing namespace, an empty article, a changed GUID,
// a draft or Spanish post leaking in -- fails CI before it deploys.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const SITE = 'https://blog.wbt4god.com';
const FEED = process.argv[2] ?? 'dist/rss.xml';
const POSTS = 'src/content/posts';
const NS = {
	content: 'http://purl.org/rss/1.0/modules/content/',
	dc: 'http://purl.org/dc/elements/1.1/',
};

const failures = [];
const fail = (msg) => failures.push(msg);

const xml = readFileSync(FEED, 'utf8');

// 1. Well-formed XML.
const valid = XMLValidator.validate(xml);
if (valid !== true) {
	console.error(`${FEED} is not well-formed XML: ${valid.err.msg} (line ${valid.err.line})`);
	process.exit(1);
}

const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const doc = new XMLParser({
	ignoreAttributes: false,
	parseTagValue: false,
	isArray: (name) => name === 'item' || name === 'category',
}).parse(xml);
const rss = doc.rss;
const items = asArray(rss?.channel?.item);

// 2. Namespaces: every prefix used is declared with the right URI.
if (rss?.['@_version'] !== '2.0') fail('<rss> is not version="2.0"');
for (const [prefix, uri] of Object.entries(NS)) {
	if (rss?.[`@_xmlns:${prefix}`] !== uri) fail(`xmlns:${prefix} is not declared as ${uri}`);
}
for (const prefix of new Set([...xml.matchAll(/<\/?([a-zA-Z]+):/g)].map((m) => m[1]))) {
	if (!(prefix in NS)) fail(`undeclared or unexpected namespace prefix "${prefix}:"`);
}
if (/<author[\s>]/.test(xml)) fail('<author> present; RSS requires an email there -- use dc:creator');
if (rss?.channel?.language !== 'en-us') fail('channel <language> is not en-us');

// 3. Expected items, straight from the sources: English, not draft.
const expected = new Map();
for (const file of readdirSync(POSTS).filter((f) => f.endsWith('.md'))) {
	const { frontmatter: fm } = parseFrontmatter(readFileSync(join(POSTS, file), 'utf8'));
	if ((fm.lang ?? 'en') !== 'en' || fm.draft === true) continue;
	const url = `${SITE}/posts/${fm.slug ?? file.replace(/\.md$/, '')}/`;
	expected.set(url, { file, fm });
}

const seen = new Set();
for (const item of items) {
	const guid = item.guid?.['#text'];
	const label = guid ?? item.title;
	if (seen.has(guid)) fail(`duplicate GUID ${guid}`);
	seen.add(guid);

	// Stable GUIDs: the permalink, unchanged from before content:encoded.
	if (item.guid?.['@_isPermaLink'] !== 'true') fail(`${label}: guid is not isPermaLink="true"`);
	if (guid !== item.link) fail(`${label}: guid differs from link`);
	const source = expected.get(guid);
	if (!source) {
		fail(`${label}: not an English published post (draft, Spanish, or unknown)`);
		continue;
	}
	const { fm, file } = source;

	if (item.title !== fm.title) fail(`${label}: title differs from ${file}`);
	if (item.description !== fm.description) fail(`${label}: description is not the frontmatter summary`);
	const pubDate = new Date(fm.pubDate).toUTCString();
	if (item.pubDate !== pubDate) fail(`${label}: pubDate ${item.pubDate}, expected ${pubDate}`);
	const categories = [fm.service, fm.primaryPassage, ...(fm.tags ?? [])].filter(Boolean);
	if (JSON.stringify(asArray(item.category)) !== JSON.stringify(categories)) {
		fail(`${label}: categories differ from frontmatter`);
	}
	if ((item['dc:creator'] ?? undefined) !== (fm.preacher ?? undefined)) {
		fail(`${label}: dc:creator is "${item['dc:creator']}", expected "${fm.preacher}"`);
	}

	// 4. Full article body, safe and absolute.
	const html = item['content:encoded'] ?? '';
	if (html.replace(/<[^>]*>/g, '').trim().length < 200) fail(`${label}: content:encoded is missing or too short`);
	if (/<h1[\s>]/.test(html)) fail(`${label}: content repeats the title as <h1>`);
	if (/<(script|style|iframe|object|embed|form)[\s>]/i.test(html)) fail(`${label}: content has an unsafe element`);
	if (/\son[a-z]+\s*=/i.test(html)) fail(`${label}: content has an event-handler attribute`);
	if (/\s(class|style)\s*=/i.test(html)) fail(`${label}: content has site-specific class/style attributes`);
	for (const [, attr, url] of html.matchAll(/\s(href|src)\s*=\s*"([^"]*)"/gi)) {
		const ok = attr === 'src' ? /^https?:\/\//.test(url) : /^(https?:\/\/|mailto:|tel:)/.test(url);
		if (!ok) fail(`${label}: ${attr}="${url}" is not absolute`);
		if (url.startsWith(`http://${SITE.slice('https://'.length)}`)) fail(`${label}: ${attr} uses http for this site`);
	}
}

for (const [url, { file }] of expected) {
	if (!seen.has(url)) fail(`${file}: published English post missing from the feed`);
}

if (failures.length) {
	console.error(`${FEED}: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
	process.exit(1);
}
console.log(`${FEED}: OK -- ${items.length} items, well-formed, namespaces declared, full content, GUIDs = permalinks, no drafts or Spanish posts.`);

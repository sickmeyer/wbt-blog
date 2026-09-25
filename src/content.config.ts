import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One schema for both collections. The Markdown files come from EchoPulpit
// (scripts/import-echopulpit.py) or are written by hand; the `slug`
// frontmatter field becomes the URL: /posts/<slug>/.
const post = z.object({
	title: z.string(),
	description: z.string(),
	pubDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	preacher: z.string().optional(),
	service: z.string().optional(),
	primaryPassage: z.string().optional(),
	scripture: z.array(z.string()).default([]),
	keywords: z.array(z.string()).default([]),
	tags: z.array(z.string()).default([]),
	audioUrl: z.url().optional(),
	videoUrl: z.url().optional(),
	sourceId: z.string().optional(),
	// 'es' posts are shown under /es/ (Spanish service); English is the default.
	lang: z.enum(['en', 'es']).default('en'),
	// EchoPulpit's "Unpublish" sets this to pull a post from the live site
	// without deleting it; "Republish" clears it. See src/lib/posts.ts.
	draft: z.boolean().default(false),
});

// Published posts: committed to the repo and deployed.
const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
	schema: post,
});

// Drafts: git-ignored (the repo is public), shown only by `npm run dev`.
const drafts = defineCollection({
	loader: glob({ base: './src/content/drafts', pattern: '**/*.md' }),
	schema: post,
});

export const collections = { posts, drafts };

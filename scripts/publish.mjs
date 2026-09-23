#!/usr/bin/env node
// Publish a reviewed draft: move it from src/content/drafts/ (git-ignored,
// local preview only) to src/content/posts/ (committed and deployed).
//
//   npm run publish-draft -- <slug or filename>   publish one draft
//   npm run publish-draft                         list drafts
//
// Then commit and push; the GitHub Action rebuilds and deploys the site.
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const DRAFTS = 'src/content/drafts';
const POSTS = 'src/content/posts';

const drafts = readdirSync(DRAFTS).filter((f) => f.endsWith('.md'));
const slugOf = (file) => readFileSync(join(DRAFTS, file), 'utf8').match(/^slug:\s*['"]?([^'"\n]+)/m)?.[1];

const wanted = process.argv[2];
if (!wanted) {
	console.log(drafts.length ? 'Drafts:' : 'No drafts.');
	for (const f of drafts) console.log(`  ${slugOf(f) ?? '(no slug)'}  <-  ${f}`);
	process.exit(0);
}

const file = drafts.find((f) => f === wanted || f === `${wanted}.md` || slugOf(f) === wanted);
if (!file) {
	console.error(`No draft matches "${wanted}". Run "npm run publish-draft" to list drafts.`);
	process.exit(1);
}
if (existsSync(join(POSTS, file))) {
	console.error(`${POSTS}/${file} already exists; not overwriting.`);
	process.exit(1);
}
renameSync(join(DRAFTS, file), join(POSTS, file));
console.log(`Published ${file} -> ${POSTS}/`);
console.log('Next: git add src/content/posts && git commit -m "Publish: <title>" && git push');

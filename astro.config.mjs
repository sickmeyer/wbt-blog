// @ts-check

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkStripLeadingH1 from './src/lib/remark-strip-leading-h1.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.wbt4god.com',
	trailingSlash: 'always',
	integrations: [sitemap()],
	markdown: {
		remarkPlugins: [remarkStripLeadingH1],
	},
});

// @ts-check

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.wbt4god.com',
	trailingSlash: 'always',
	integrations: [sitemap()],
});

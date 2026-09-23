# Blog

A static blog built with [Astro](https://astro.build) and deployed to GitHub
Pages on every push to `main`.

## Development

```bash
npm install
npm run dev      # local preview at http://localhost:4321/
npm run build    # production build + search index into dist/
npm run check    # type-check
```

## Content

Posts are Markdown files in `src/content/posts/`. The frontmatter schema is
in `src/content.config.ts`.

Site settings are in `src/consts.ts`, and styles are in
`src/styles/global.css`.

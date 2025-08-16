# AI Coding Agent Instructions

## Project Overview
Hugo-based jewelry website with Decap CMS, featuring Instagram integration and automated content management. Built for jewelry brand with focus on clean, maintainable code.

## Key Principles
- **Refactor, don't create new files** - Modify existing files instead of creating duplicates
- **Clean as you go** - Remove temporary/backup files immediately after changes
- **One solution per request** - Provide single, focused implementation
- **Preserve working functionality** - Keep essential files like `product-creator.js` for future use

## Architecture
```
├── site/                    # Hugo content & layouts
│   ├── content/products/    # Generated product pages from Instagram
│   ├── layouts/partials/    # Reusable Hugo components
│   └── static/img/          # Images including logo.jpg from Instagram
├── src/                     # Frontend assets (webpack processed)
├── scripts/                 # Node.js automation scripts
└── dist/                    # Built site output
```

## Essential Scripts & Commands
```bash
# Development
npm start                    # Hugo + webpack dev servers
npm run start:proxy         # Decap CMS proxy for local editing

# Instagram Integration
npm run scrape:instagram https://www.instagram.com/username
# Opens browser, handles cookies, right-clicks profile pic for manual save

# Building
npm run build:netlify       # Production build for deployment
npm run build:preview       # Preview with drafts/future content
```

## Critical Patterns

### Instagram Scraper (`scripts/instagram-scraper.js`)
- Uses Puppeteer with persistent browser data (`d:\puppeteer-data`)
- Proxy configuration: `localhost:10808`
- Cookie handling: Finds "Allow all cookies" button by text content
- Image saving: Right-clicks profile picture, user saves manually via browser
- **Never create scraper variants** - refactor existing file only

### Hugo Content Structure
- Products: Generated as `site/content/products/{postId}.md`
- Layouts: `site/layouts/` with partials system
- Static assets: `site/static/img/` for images

### Development Workflow
- ESLint config: Browser-focused (`.eslintrc.yml`)
- Scripts use Node.js env: Add `/* eslint-env node, es2020 */` to script files
- Webpack handles frontend bundling, Hugo handles content

## Integration Points
- **Decap CMS**: `site/static/admin/config.yml` defines content structure
- **Instagram → Hugo**: Scripts create markdown files with frontmatter
- **Netlify Identity**: User management for CMS access
- **Jewelry Focus**: Product-specific templates and image generation

## Common Tasks
- Modifying Instagram scraper: Edit `scripts/instagram-scraper.js` in place
- Adding product fields: Update both Decap CMS config and Hugo templates
- Asset changes: Modify `src/` files (webpack processes them)
- Content structure: Edit Hugo layouts in `site/layouts/`

## File Naming Conventions
- Scripts: `kebab-case.js` in `scripts/` directory
- Hugo content: `lowercase-with-hyphens.md`
- Images: `descriptive-name.jpg` in appropriate `static/` subdirectory
- No version suffixes or backup files in repository

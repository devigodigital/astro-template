# Astro + Devigo Studio

A minimal [Astro](https://astro.build) starter template powered by [Devigo Studio](https://devigo.studio) as the headless CMS.

The philosophy is simple: static sites are cheaper and faster. Devigo Studio breathes life into them by providing content through its Display API. This template connects the two so you can focus on building your site.

## How it works

Devigo Studio is a headless CMS. You manage pages, posts, menus, and media inside the Devigo Studio dashboard. This Astro template fetches that content at build time (or per-request in SSR mode) using the official `devigo` JavaScript SDK and renders it as HTML.

**You write zero content in this codebase.** Everything comes from Devigo.

## Project structure

```
src/
  lib/
    devigo.js               # SDK client + post type config
  layouts/
    Layout.astro            # HTML shell — head/SEO, menus, site settings
  lib/
    devigo.js               # SDK client + site config (site name, post types)
    url.js                  # internalHref() — canonical trailing-slash links
  components/
    PageSections.astro      # Maps CMS component names to .astro files
    menus/
      Header.astro          # Renders the logo + header menu
      Footer.astro          # Renders the logo, footer menu, company line
      MenuItems.astro       # Recursive menu renderer (unlimited nesting)
  pages/
    [...slug].astro         # CMS pages (/, /about/, /contact/, etc.)
    404.astro               # CMS-managed 404, built to /404.html
    llms.txt.ts             # /llms.txt index for LLMs and crawlers
    [type]/
      index.astro           # Post type listing (e.g. /blog/)
      [...slug].astro       # Post type entry (e.g. /blog/my-post/)
      [...slug].md.ts       # Markdown companion (e.g. /blog/my-post.md)
      page/[page].astro     # Paginated listing (e.g. /blog/page/2/)
```

### What each piece does

| File | Role |
|---|---|
| `src/lib/devigo.js` | Creates a single SDK client instance using your API token. Also holds the site config you edit: `siteName`, `postTypes`, `postsPerPage`, `NOT_FOUND_SLUG`, plus `getSettings()` and the `pageTitle()` helper. |
| `src/lib/url.js` | `internalHref()` — normalises internal links to the canonical trailing-slash form so links never bounce through a 301. |
| `src/layouts/Layout.astro` | Wraps every page. Fetches the `header`/`footer` menus and site settings, and renders the whole head: title, meta description, canonical, Open Graph, Twitter card and JSON-LD. |
| `src/components/PageSections.astro` | Renders a CMS page's sections by matching each CMS component name to a file in `src/components` (`"Hero Banner"` → `HeroBanner.astro`, `"Content & Image"` → `ContentAndImage.astro`). |
| `src/components/menus/MenuItems.astro` | Takes an array of menu items and renders them as nested `<ul>`/`<li>` elements. Calls itself recursively for child items, so nesting depth is unlimited. |
| `src/pages/[...slug].astro` | Catches all top-level slugs. Fetches pages from Devigo and renders their sections via `PageSections`. |
| `src/pages/404.astro` | Renders the CMS page whose slug is `NOT_FOUND_SLUG` (falls back to static copy). Built to `/404.html`, marked `noindex`, and excluded from routable pages and the sitemap. |
| `src/pages/llms.txt.ts` | Generates `/llms.txt` — a plain-text index of pages and posts for LLMs and crawlers. |
| `src/pages/[type]/index.astro` | Generates a listing page for each post type defined in `postTypes` (e.g. `/blog/`). Skipped if a CMS page already owns that slug. |
| `src/pages/[type]/[...slug].astro` | Generates an individual page for every post entry across all post types (e.g. `/blog/my-post/`). |
| `src/pages/[type]/[...slug].md.ts` | Emits a clean markdown version of each post at `/blog/my-post.md` for LLM ingestion; linked from `/llms.txt`. |

## SEO and metadata

Every page goes through `Layout.astro`, which renders:

- `<title>` and `<meta name="description">`
- `<link rel="canonical">` (or `<meta name="robots" content="noindex">` when the `noindex` prop is set)
- Open Graph tags (`og:site_name`, `og:type`, `og:url`, `og:title`, `og:description`, `og:image`)
- Twitter card tags (`summary_large_image`)
- JSON-LD — an `Organization` schema on the homepage, `BlogPosting` on post entries, or anything you pass via the `jsonLd` prop

Titles and descriptions come from the CMS: set **Title tag** and **Meta description** per page in Devigo Studio (`title_tag` / `meta_description`). If a page has no title tag, the title falls back to `"{page name} | {siteName}"`. **A page with no title at all fails the build** — that's deliberate, so a site can't go live with blank titles.

The share image falls back to `/public/og-card.png` (1200×630). A neutral placeholder ships with the template — **replace it with your own**. Post entries use their `image` field as the share image when one is set.

| Prop | What it does |
|---|---|
| `title` | Required. The `<title>`. Build it with `pageTitle()`. |
| `description` | Meta description, `og:description`, `twitter:description`. |
| `ogImage` | Absolute URL of a page-specific share image. Defaults to `/og-card.png`. |
| `ogType` | `website` (default) or `article`. |
| `noindex` | Drops the canonical and adds `robots: noindex`. |
| `jsonLd` | An extra schema.org object rendered as `ld+json`. |

## 404 page

Create a page in Devigo Studio with the slug `404-page-not-found` (see `NOT_FOUND_SLUG` in `src/lib/devigo.js`). It's rendered by `src/pages/404.astro` into `/404.html` and excluded from routable pages, the sitemap and `/llms.txt`, so it can never be indexed as a soft 404.

Point your web server at it so unmatched URLs get a real 404 status — for nginx:

```nginx
error_page 404 /404.html;
```

## Trailing slashes

Astro's `trailingSlash` is left at the default (`'ignore'`) so the dev server accepts both `/about` and `/about/`. The canonical form is the trailing-slash one, enforced in two places: internal links are normalised through `internalHref()` (`src/lib/url.js`), and your web server should 301 the bare form in production.

## Getting started

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your credentials from the Devigo Studio dashboard:

```sh
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DEVIGO_API_TOKEN` | Your Devigo Display API bearer token |
| `DEVIGO_SITE_ID` | Your site's base URL (used by the SDK to call the Display API) |
| `DEVIGO_API_DOMAIN` | Display API host — change only if you serve assets through a custom CDN |
| `ENVIRONMENT` | Which content set to pull: `local`, `staging` or `live` |
| `PORT` | Dev server port (default `4321`) |

### 3. Set your site name and post types

Open `src/lib/devigo.js`. Set `siteName` — it's the suffix on every page title and the `og:site_name` value (the CMS `company_name` setting wins where it's available):

```js
export const siteName = 'Acme';
```

Then add your post type slugs to the `postTypes` array. These must match the slugs you set up in Devigo Studio:

```js
export const postTypes = ['blog', 'projects', 'team'];
```

Keep the `postTypes` array in `astro.config.mjs` in sync — that's what the dev server watches for live reload.

### 4. Run the dev server

```sh
npm run dev
```

## Static vs SSR

By default this template runs in **static** mode -- every page is generated at build time. This is the cheapest and fastest option for most sites.

To switch to **SSR** (server-rendered on each request):

1. Install an Astro adapter (e.g. `npm install @astrojs/node`)
2. Update `astro.config.mjs`:
   ```js
   import node from '@astrojs/node';

   export default defineConfig({
     output: 'server',
     adapter: node({ mode: 'standalone' }),
   });
   ```
3. In each page file (`[...slug].astro`, `[type]/[...slug].astro`), comment out `getStaticPaths` and uncomment the SSR block -- both are marked with clear comments in the code.

## Before you go live

A few things to update before deploying to production:

| What | Where | Why |
|---|---|---|
| `site` URL | `astro.config.mjs` | Used to generate canonical URLs, the sitemap, `/llms.txt` and OG tags. Change `https://example.com` to your real domain. |
| Sitemap URL | `public/robots.txt` | Update the `Sitemap:` line to match your real domain. |
| `siteName` | `src/lib/devigo.js` | The title suffix and `og:site_name`. Defaults to `Your Site`. |
| Share image | `public/og-card.png` | A neutral 1200×630 placeholder ships with the template. Replace it with your own. |
| Favicon | `public/favicon.svg` / `public/favicon.ico` | Replace with your own. |
| 404 page | Devigo Studio + web server | Create the `404-page-not-found` page and add `error_page 404 /404.html;` to your server config. |
| `<html lang>` | `src/layouts/Layout.astro` | Defaults to `en`. Change if your site is in another language. |
| `ENVIRONMENT` | `.env` | Set to `live` in production (`staging` on staging). |

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview the build locally |

## Learn more

- [Astro documentation](https://docs.astro.build)
- [Devigo Studio](https://devigo.studio)
- [Devigo SDK (`devigo` on npm)](https://www.npmjs.com/package/devigo)

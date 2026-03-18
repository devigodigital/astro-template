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
    Layout.astro            # HTML shell, fetches header/footer menus
  components/
    Header.astro            # Renders the header menu
    Footer.astro            # Renders the footer menu
    MenuItems.astro         # Recursive menu renderer (unlimited nesting)
  pages/
    [...slug].astro         # CMS pages (/, /about, /contact, etc.)
    [type]/
      index.astro           # Post type listing (e.g. /blog)
      [...slug].astro       # Post type entry (e.g. /blog/my-post)
```

### What each piece does

| File | Role |
|---|---|
| `src/lib/devigo.js` | Creates a single SDK client instance using your API token. Also exports a `postTypes` array you edit to register your post types. |
| `src/layouts/Layout.astro` | Wraps every page. Fetches the `header` and `footer` menus from Devigo and passes them to the Header/Footer components. |
| `src/components/MenuItems.astro` | Takes an array of menu items and renders them as nested `<ul>`/`<li>` elements. Calls itself recursively for child items, so nesting depth is unlimited. |
| `src/pages/[...slug].astro` | Catches all top-level slugs. Fetches pages from Devigo and renders their sections, rows, columns, and components. |
| `src/pages/[type]/index.astro` | Generates a listing page for each post type defined in `postTypes` (e.g. `/blog`). |
| `src/pages/[type]/[...slug].astro` | Generates an individual page for every post entry across all post types (e.g. `/blog/my-post`). |

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

### 3. Register your post types

Open `src/lib/devigo.js` and add your post type slugs to the `postTypes` array. These must match the slugs you set up in Devigo Studio:

```js
export const postTypes = ['blog', 'projects', 'team'];
```

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
| `site` URL | `astro.config.mjs` | Used to generate canonical URLs, the sitemap, and OG tags. Change `https://example.com` to your real domain. |
| Sitemap URL | `public/robots.txt` | Update the `Sitemap:` line to match your real domain. |
| Favicon | `public/favicon.svg` / `public/favicon.ico` | Replace with your own. |
| `<html lang>` | `src/layouts/Layout.astro` | Defaults to `en`. Change if your site is in another language. |

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

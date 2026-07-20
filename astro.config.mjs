// @ts-check
import { loadEnv } from 'vite'
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { devigoIntegration } from 'devigo/astro';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',

	// trailingSlash is left at the default ('ignore') so the dev server accepts
	// both /about and /about/. The canonical trailing-slash form is enforced
	// where it matters for SEO: every internal link is normalised via
	// internalHref() in src/lib/url.js, and the web server 301s the bare form
	// in production.

	// Default: static site generation (all pages built at build time).
	// To switch to SSR (server-rendered), change output to 'server'
	// and install an adapter e.g. @astrojs/node or @astrojs/vercel:
	//   npm install @astrojs/node
	//   import node from '@astrojs/node';
	//   Then add: adapter: node({ mode: 'standalone' })
	// output: 'server',

	server: {
		port: Number(env.PORT) || 4321,
	},

	integrations: [sitemap({
			// The 404 page is built to /404.html for the web server to serve on
			// unmatched URLs — it must never appear in the sitemap.
			filter: (page) => !page.includes('/404'),
		}), devigoIntegration({
      token: env.DEVIGO_API_TOKEN,
      baseUrl: env.DEVIGO_API_DOMAIN,
      siteId: env.DEVIGO_SITE_ID,
      environment: env.ENVIRONMENT,
      // Post types to watch for live reload in dev mode.
      // Keep in sync with postTypes in src/lib/devigo.js.
      postTypes: [],
  	})],
});

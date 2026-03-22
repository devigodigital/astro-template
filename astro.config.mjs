// @ts-check
import { loadEnv } from 'vite'
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { devigoIntegration } from 'devigo/astro';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',

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

	integrations: [sitemap(), devigoIntegration({
      token: env.DEVIGO_API_TOKEN,
      baseUrl: env.DEVIGO_API_DOMAIN,
      siteId: env.DEVIGO_SITE_ID,
      environment: env.ENVIRONMENT,
      // Post types to watch for live reload in dev mode.
      // Keep in sync with postTypes in src/lib/devigo.js.
      postTypes: [],
  	})],
});

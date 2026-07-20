// Devigo SDK client + site config — single instance shared across the project.
// Reads credentials from environment variables set in .env.

import { createClient } from 'devigo';

export const devigo = createClient({
	token: import.meta.env.DEVIGO_API_TOKEN,
	baseUrl: import.meta.env.DEVIGO_API_DOMAIN,
	siteId: import.meta.env.DEVIGO_SITE_ID,
	environment: import.meta.env.ENVIRONMENT,
});

// Site name — the suffix on every page title ("About | Acme"), the og:site_name
// value, and the heading in /llms.txt. Site settings from the CMS
// (`company_name`) win where they're available; this is the fallback.
export const siteName = 'Your Site';

// Slug of the CMS-managed 404 page. It's rendered by src/pages/404.astro and
// deliberately excluded from routable pages, the sitemap and llms.txt.
// Create a page with this slug in Devigo Studio to control the 404 content.
export const NOT_FOUND_SLUG = '404-page-not-found';

// Post type slugs registered in your Devigo site.
// Add each post type slug here so that static paths can be generated.
// Example: ['blog', 'projects', 'team']
export const postTypes = [];

// Number of entries shown per page on post type listings.
export const postsPerPage = 10;

// Build a page title with the site name appended.
export function pageTitle(name) {
	return name ? `${name} | ${siteName}` : siteName;
}

// Site settings (logos, company name/number) — the SDK has no settings resource
// yet, so fetch the display API's /settings endpoint directly using the same
// auth + path pattern the SDK uses. Returns the settings object, or {} on failure.
export async function getSettings() {
	const baseUrl = import.meta.env.DEVIGO_API_DOMAIN.replace(/\/$/, '');
	const siteId = import.meta.env.DEVIGO_SITE_ID;
	const token = import.meta.env.DEVIGO_API_TOKEN;
	const environment = import.meta.env.ENVIRONMENT || 'live';

	const response = await fetch(
		`${baseUrl}/api/display/${siteId}/settings?environment=${environment}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!response.ok) return {};
	const data = await response.json();
	return data.settings ?? {};
}

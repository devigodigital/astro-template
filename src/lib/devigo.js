// Devigo SDK client — single instance shared across the project.
// Reads credentials from environment variables set in .env.

import { createClient } from 'devigo';

export const devigo = createClient({
	token: import.meta.env.DEVIGO_API_TOKEN,
	baseUrl: import.meta.env.DEVIGO_API_DOMAIN,
	siteId: import.meta.env.DEVIGO_SITE_ID,
	environment: import.meta.env.ENVIRONMENT,
});

// Post type slugs registered in your Devigo site.
// Add each post type slug here so that static paths can be generated.
// Example: ['blog', 'projects', 'team']
export const postTypes = [];

// Number of entries shown per page on post type listings.
export const postsPerPage = 10;
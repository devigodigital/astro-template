// URL helpers shared by every component that renders a link.

// Normalise an internal href to the canonical trailing-slash form so internal
// links never bounce through a server-side 301 redirect (non-slash → slash).
// CMS-supplied URLs (menus, buttons) arrive without trailing slashes, so every
// internal href should pass through here before rendering.
//
// Leaves untouched: external/absolute URLs (http, mailto, tel, protocol-
// relative), fragment/query-only links, and paths to files (e.g. /llms.txt,
// /sitemap-index.xml). Query strings and hashes are preserved.
export function internalHref(url) {
	if (typeof url !== 'string' || url === '') return url;
	if (!url.startsWith('/') || url.startsWith('//')) return url;

	const [, path, suffix = ''] = url.match(/^([^?#]*)([?#].*)?$/);
	if (path.endsWith('/') || /\.[a-zA-Z0-9]+$/.test(path)) return url;
	return `${path}/${suffix}`;
}

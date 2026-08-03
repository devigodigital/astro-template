// Rich text — sanitising and preparing CMS rich text HTML for rendering.
//
// The rich text field replaces the older markdown and wysiwyg fields. Its value
// is raw HTML, usually pasted out of Google Docs or Word, so it can only be
// rendered with `set:html` — which means it has to be trusted, and it isn't.
//
// Devigo Studio runs an allow-list over rich text when an entry is *saved*, but
// deliberately never on the way out of storage, and the legacy markdown/wysiwyg
// values predate that allow-list entirely. So every string that reaches
// `set:html` is re-sanitised here, at build time. The allow-list below mirrors
// HtmlSanitiser::ALLOWED on the server; keep the two in step.
//
// Usage: prefer the <RichText> component (src/components/RichText.astro) — it
// calls into this module. Reach for these functions directly when you need the
// cleaned string itself (meta descriptions, the .md companions, JSON-LD).

import sanitizeHtml from 'sanitize-html';

// Everything an SEO-formatted article uses: heading structure, tables, lists,
// links, images. Anything outside this list is unwrapped, keeping its text.
const ALLOWED_TAGS = [
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'p', 'br', 'hr',
	'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
	'ul', 'ol', 'li',
	'blockquote', 'pre', 'code',
	'table', 'thead', 'tbody', 'tfoot', 'caption', 'tr', 'th', 'td',
	'a', 'img',
];

// `id` on headings only — in-page anchor links are a routine SEO request.
// colspan/rowspan are allowed so merged cells pasted from a document survive.
// Note what is absent: `style`, `class` and every `on*` handler.
const ALLOWED_ATTRIBUTES = {
	a: ['href', 'title', 'target', 'rel'],
	img: ['src', 'alt', 'title', 'width', 'height'],
	td: ['colspan', 'rowspan'],
	th: ['colspan', 'rowspan', 'scope'],
	h1: ['id'],
	h2: ['id'],
	h3: ['id'],
	h4: ['id'],
	h5: ['id'],
	h6: ['id'],
};

// Dropped along with their contents — these never carry article copy, and
// discarding the tag while keeping the text would leak script source onto the
// page as visible text.
const NON_TEXT_TAGS = ['script', 'style', 'noscript', 'head', 'title', 'textarea', 'option', 'iframe', 'object', 'embed'];

// Hosts permitted when embeds are opted into (see `allowEmbeds` below).
// Anything not on this list is dropped, so a pasted iframe can't point at an
// arbitrary origin.
export const EMBED_HOSTNAMES = [
	'www.youtube.com',
	'youtube.com',
	'www.youtube-nocookie.com',
	'player.vimeo.com',
];

/**
 * Field keys that hold rich text body content, in priority order: the rich text
 * editor wins over the fields it replaced.
 *
 * Devigo keys a field by its type and suffixes duplicates (`richtext`,
 * `richtext_1`, …), so these keys identify the field type reliably — the
 * suffixed forms are matched by pattern below.
 *
 * Deliberately *not* included: generic names like `content` or `body`. A field
 * called `content` is as likely to be a plain textarea, and routing plain text
 * through set:html would mangle any '<' the author typed. If your rich text
 * field was renamed in Devigo Studio, add its key here.
 */
export const RICH_TEXT_KEYS = ['richtext', 'rich_text', 'wysiwyg', 'markdown_html'];

const RICH_TEXT_KEY_PATTERN = /^(?:richtext|rich_text|wysiwyg|markdown_html)(?:_\d+)?$/;

/**
 * Force `rel="noopener noreferrer"` on links that open in a new tab, and drop
 * any other target (matching the server, which permits `_blank` only).
 */
function hardenLink(tagName, attribs) {
	const next = { ...attribs };

	if (next.target && next.target !== '_blank') delete next.target;
	if (next.target === '_blank') next.rel = 'noopener noreferrer';

	return { tagName, attribs: next };
}

/**
 * Sanitise a rich text HTML string against the allow-list.
 *
 * Returns '' for anything that isn't a non-empty string, so callers can render
 * the result directly without a type guard.
 *
 * @param {unknown} html                     the raw CMS value
 * @param {object} [options]
 * @param {boolean} [options.allowEmbeds]    permit <iframe> from EMBED_HOSTNAMES.
 *                                           Off by default: an iframe runs
 *                                           third-party code in your origin's
 *                                           frame tree, so it's opt-in per call.
 * @param {string[]} [options.allowedTags]   extra tags to permit
 * @param {object} [options.allowedAttributes] extra per-tag attributes to permit
 * @param {string[]} [options.allowedIframeHostnames] override EMBED_HOSTNAMES
 * @returns {string} sanitised HTML
 */
export function sanitizeRichText(html, options = {}) {
	if (typeof html !== 'string' || html.trim() === '') return '';

	const {
		allowEmbeds = false,
		allowedTags = [],
		allowedAttributes = {},
		allowedIframeHostnames = EMBED_HOSTNAMES,
	} = options;

	const embedTags = allowEmbeds ? ['iframe'] : [];
	const embedAttributes = allowEmbeds
		? { iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'] }
		: {};

	return sanitizeHtml(html, {
		allowedTags: [...ALLOWED_TAGS, ...embedTags, ...allowedTags],
		allowedAttributes: { ...ALLOWED_ATTRIBUTES, ...embedAttributes, ...allowedAttributes },

		// javascript: and data: URIs are rejected. Base64 images pasted from Word
		// go with them — those are sideloaded into the media library on import.
		allowedSchemes: ['http', 'https', 'mailto', 'tel'],
		allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
		allowProtocolRelative: false,

		// `iframe` is in NON_TEXT_TAGS so it's dropped with its contents when
		// embeds are off; listing it in allowedTags above overrides that.
		nonTextTags: allowEmbeds ? NON_TEXT_TAGS.filter((t) => t !== 'iframe') : NON_TEXT_TAGS,
		disallowedTagsMode: 'discard',
		allowedIframeHostnames,

		transformTags: { a: hardenLink },

		// An <img>/<iframe> whose src the allow-list rejected would otherwise
		// remain as an empty element, rendering as a broken-image placeholder.
		// Anchors are left alone even without an href — the link text is content,
		// and dropping the element would take the words with it.
		exclusiveFilter: (frame) => (frame.tag === 'img' || frame.tag === 'iframe') && !frame.attribs.src,
	});
}

/**
 * Wrap each top-level <table> so wide tables scroll inside their own container
 * instead of pushing the page sideways on mobile.
 *
 * Runs on already-sanitised markup. Depth is tracked so a nested table (legal
 * in pasted HTML, though the editor can't author one) doesn't get its own
 * wrapper inside its parent's.
 */
export function wrapTables(html, className = 'rich-text__table-wrap') {
	if (typeof html !== 'string' || !html.includes('<table')) return html ?? '';

	let depth = 0;

	return html.replace(/<(\/?)table\b[^>]*>/gi, (tag, slash) => {
		if (slash) {
			depth = Math.max(0, depth - 1);
			return depth === 0 ? `${tag}</div>` : tag;
		}

		depth += 1;
		return depth === 1 ? `<div class="${className}">${tag}` : tag;
	});
}

/**
 * Find the body content on a post entry's field_values.
 *
 * Returns the key as well as the value so the caller can exclude it when
 * iterating the remaining fields — otherwise the body renders twice.
 *
 * @param {Record<string, unknown>} fieldValues
 * @returns {{ key: string | null, html: string }}
 */
export function pickRichText(fieldValues) {
	const fv = fieldValues ?? {};

	const isBody = (key) => typeof fv[key] === 'string' && fv[key].trim() !== '';

	for (const key of RICH_TEXT_KEYS) {
		if (isBody(key)) return { key, html: fv[key] };
	}

	// Suffixed duplicates (richtext_1, …) — take the lowest-numbered one so the
	// order is stable across builds rather than dependent on key insertion.
	const suffixed = Object.keys(fv).filter((key) => RICH_TEXT_KEY_PATTERN.test(key) && isBody(key)).sort();
	if (suffixed.length) return { key: suffixed[0], html: fv[suffixed[0]] };

	return { key: null, html: '' };
}

const ENTITIES = {
	'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/**
 * Flatten rich text to plain text for contexts that can't take markup —
 * <title>, meta descriptions, og:title, JSON-LD values.
 *
 * Sanitises first so script contents can't survive tag-stripping, then decodes
 * the entities an editor leaves behind.
 */
export function richTextToPlainText(html) {
	if (typeof html !== 'string' || html.trim() === '') return '';

	return sanitizeRichText(html)
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match])
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Truncate plain text to a meta-description-sized string, breaking on a word
 * boundary rather than mid-word.
 */
export function excerptFrom(html, maxLength = 155) {
	const text = richTextToPlainText(html);
	if (!text) return undefined;
	if (text.length <= maxLength) return text;

	const cut = text.slice(0, maxLength);
	const lastSpace = cut.lastIndexOf(' ');

	return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Pull a leading <h1> off the body.
 *
 * When an author's pasted document opens with its own H1, that heading is the
 * real post title. Promote it into the page heading and strip it from the body
 * so the page keeps exactly one H1.
 *
 * @returns {{ title: string | undefined, html: string }} title is plain text
 */
export function extractLeadingHeading(html) {
	if (typeof html !== 'string' || html.trim() === '') return { title: undefined, html: '' };

	// Only a *leading* h1 counts — one further down the document is a section
	// heading the author intended to keep.
	const match = html.match(/^\s*(?:<(?:p|div|br)\s*\/?>\s*)*<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
	if (!match) return { title: undefined, html };

	const title = richTextToPlainText(match[1]);
	if (!title) return { title: undefined, html };

	return { title, html: html.replace(match[0], '') };
}

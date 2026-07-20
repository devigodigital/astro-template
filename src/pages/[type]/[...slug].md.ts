// Markdown companion for post entries — emitted at build time at
// /<type>/<slug>.md so LLMs and the /llms.txt index can ingest clean text
// instead of parsing the rendered page.
//
// Static mode: getStaticPaths mirrors the loop in [...slug].astro across every
// registered post type. GET assembles a standalone markdown document: it
// prefers the CMS raw `markdown` field, otherwise converts the rendered
// `markdown_html` to markdown with the string-based converter below (there's no
// DOM at build time, hence the hand-rolled implementation).

import type { APIRoute } from 'astro';
import { devigo, postTypes } from '../../lib/devigo.js';

// ── getStaticPaths ───────────────────────────────────────────────────────────
export async function getStaticPaths() {
	const paths = [];

	for (const type of postTypes) {
		try {
			const collection = await devigo.posts(type).list();
			for (const entry of collection.data) {
				paths.push({
					params: { type, slug: entry.slug },
					props: { type, entry },
				});
			}
		} catch (error) {
			console.error(`[devigo] .md endpoint: failed to list "${type}":`, error);
		}
	}

	return paths;
}

// ── GET ──────────────────────────────────────────────────────────────────────
export const GET: APIRoute = (ctx) => {
	const { type, entry } = ctx.props as { type: string; entry: any };
	const fv: Record<string, unknown> = entry?.field_values ?? {};

	const title = pickStr(entry?.name, fv.title, fv.text, entry?.slug) || 'Untitled';
	const excerpt = pickStr(fv.excerpt, fv.text_1, fv.subtitle, fv.summary, fv.description);

	const rawMd = typeof fv.markdown === 'string' ? fv.markdown.trim() : '';
	const body = rawMd
		? rawMd
		: htmlToMarkdown(typeof fv.markdown_html === 'string' ? fv.markdown_html : pickStr(fv.content, fv.body));

	const siteBase = ctx.site instanceof URL ? ctx.site : new URL('https://example.com');
	const canonical = new URL(`/${type}/${entry.slug}/`, siteBase).href;

	const lines: string[] = [`# ${title}`];
	if (excerpt) lines.push('', `> ${excerpt.replace(/\n/g, ' ')}`);
	lines.push('', `Source: ${canonical}`, '');
	lines.push(body.trim() || '(No content)');

	return new Response(lines.join('\n') + '\n', {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};

// ── helpers ──────────────────────────────────────────────────────────────────

// Return the first non-empty string among the arguments.
function pickStr(...vals: unknown[]): string {
	for (const v of vals) {
		if (typeof v === 'string' && v.trim()) return v;
	}
	return '';
}

function decodeEntities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&#8217;/g, '’')
		.replace(/&#8216;/g, '‘')
		.replace(/&#8220;/g, '“')
		.replace(/&#8221;/g, '”')
		.replace(/&#8211;/g, '–')
		.replace(/&#8212;/g, '—');
}

function stripTags(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}

// Parse attributes out of an opening tag string like '<a href="x" class="y">'.
function attrsOf(tag: string): Record<string, string> {
	const raw = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
	const attrs: Record<string, string> = {};
	const re = /(\w[\w-]*)\s*=\s*"([^"]*)"|(\w[\w-]*)\s*=\s*'([^']*)'|(\w[\w-]*)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw))) {
		const key = (m[1] ?? m[3] ?? m[5]).toLowerCase();
		attrs[key] = m[2] ?? m[4] ?? '';
	}
	return attrs;
}

const VOID = /^(br|img|hr|input|meta|link|area|base|col|embed|source|track|wbr)$/i;

// Given HTML and an index `start` pointing at '<' of an opening tag, return the
// bounds of that element including its matching close tag (accounting for
// nesting of the same tag name). Void/self-closing tags have innerStart===innerEnd.
function tagSpan(html: string, start: number) {
	const open = html.slice(start).match(/^<(\w+)/);
	const name = (open?.[1] ?? '').toLowerCase();
	const openEnd = html.indexOf('>', start); // index of the closing '>' of the opening tag
	const selfClose = html[openEnd - 1] === '/';

	if (VOID.test(name) || selfClose) {
		const afterEnd = openEnd + 1;
		return { name, openEnd, innerStart: afterEnd, innerEnd: afterEnd, afterEnd };
	}

	const innerStart = openEnd + 1;
	const re = new RegExp(`</?${name}\\b[^>]*>`, 'gi');
	re.lastIndex = openEnd + 1;
	let depth = 1;
	let m: RegExpExecArray | null;
	let closeOpen = -1;
	while ((m = re.exec(html))) {
		if (m[0][1] === '/') {
			depth--;
			if (depth === 0) { closeOpen = m.index; break; }
		} else if (!m[0].endsWith('/>')) {
			depth++;
		}
	}

	if (closeOpen === -1) {
		return { name, openEnd, innerStart, innerEnd: html.length, afterEnd: html.length };
	}
	return { name, openEnd, innerStart, innerEnd: closeOpen, afterEnd: closeOpen + m![0].length };
}

// Convert inline-level HTML (text + <strong>, <em>, <a>, <code>, <img>, <br>…)
// to markdown, recursing into nested inline tags.
function inlineToMarkdown(html: string): string {
	let out = '';
	let i = 0;
	while (i < html.length) {
		if (html[i] === '<') {
			const open = html.slice(i).match(/^<\w+/);
			if (open) {
				const span = tagSpan(html, i);
				const inner = html.slice(span.innerStart, span.innerEnd);
				const openingTag = html.slice(i, span.openEnd + 1);
				out += convertInlineTag(span.name, openingTag, inner);
				i = span.afterEnd;
				continue;
			}
		}
		out += html[i];
		i++;
	}
	return decodeEntities(out).replace(/\s+/g, ' ');
}

function convertInlineTag(name: string, openingTag: string, inner: string): string {
	switch (name) {
		case 'br':
			return '  \n';
		case 'img': {
			const a = attrsOf(openingTag);
			return `![${a.alt ?? ''}](${a.src ?? ''})`;
		}
		case 'a': {
			const a = attrsOf(openingTag);
			const text = inlineToMarkdown(inner).trim();
			return a.href ? `[${text}](${a.href})` : text;
		}
		case 'strong':
		case 'b':
			return `**${inlineToMarkdown(inner)}**`;
		case 'em':
		case 'i':
			return `*${inlineToMarkdown(inner)}*`;
		case 'del':
		case 's':
		case 'strike':
			return `~~${inlineToMarkdown(inner)}~~`;
		case 'code':
			return '`' + decodeEntities(stripTags(inner)) + '`';
		default:
			return inlineToMarkdown(inner); // <span> and unknown inline wrappers
	}
}

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'pre', 'figure', 'hr', 'img', 'div', 'table']);

// Tokenize HTML into top-level blocks, then convert each to markdown.
function blocksToMarkdown(html: string): string {
	const blocks: { type: string; inner: string; raw: string }[] = [];
	let i = 0;
	let text = '';

	while (i < html.length) {
		if (html[i] === '<') {
			const open = html.slice(i).match(/^<(\w+)/);
			const name = open?.[1]?.toLowerCase();
			if (name && BLOCK_TAGS.has(name)) {
				if (text.trim()) blocks.push({ type: 'p', inner: text, raw: '' });
				text = '';
				const span = tagSpan(html, i);
				blocks.push({
					type: name,
					inner: html.slice(span.innerStart, span.innerEnd),
					raw: html.slice(i, span.afterEnd),
				});
				i = span.afterEnd;
				continue;
			}
		}
		text += html[i];
		i++;
	}
	if (text.trim()) blocks.push({ type: 'p', inner: text, raw: '' });

	return blocks.map(convertBlock).filter((s) => s && s.trim()).join('\n\n');
}

function convertBlock(b: { type: string; inner: string; raw: string }): string {
	switch (b.type) {
		case 'p':
			return inlineToMarkdown(b.inner).trim();
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6':
			return `${'#'.repeat(Number(b.type[1]))} ${inlineToMarkdown(b.inner).trim()}`;
		case 'ul':
			return listToMarkdown(b.inner, false);
		case 'ol':
			return listToMarkdown(b.inner, true);
		case 'blockquote':
			return blocksToMarkdown(b.inner)
				.split('\n')
				.map((l) => (l ? `> ${l}` : '>'))
				.join('\n');
		case 'pre':
			return '```\n' + decodeEntities(stripTags(b.inner)).replace(/\n+$/, '') + '\n```';
		case 'figure': {
			let out = '';
			const imgAt = b.inner.search(/<img\b/i);
			if (imgAt >= 0) {
				const span = tagSpan(b.inner, imgAt);
				const a = attrsOf(b.inner.slice(imgAt, span.afterEnd));
				out = `![${a.alt ?? ''}](${a.src ?? ''})`;
			}
			const cap = b.inner.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
			if (cap) {
				const capText = inlineToMarkdown(cap[1]).trim();
				if (capText) out += (out ? '\n\n' : '') + `_${capText}_`;
			}
			return out;
		}
		case 'img': {
			const a = attrsOf(b.raw);
			return `![${a.alt ?? ''}](${a.src ?? ''})`;
		}
		case 'hr':
			return '---';
		case 'div':
			return blocksToMarkdown(b.inner);
		case 'table':
		default:
			return inlineToMarkdown(stripTags(b.inner)).trim();
	}
}

// Split <li>...</li> items from a list's inner HTML (nesting-aware).
function extractLis(inner: string): string[] {
	const items: string[] = [];
	let i = 0;
	while (i < inner.length) {
		const at = inner.slice(i).search(/<li\b/i);
		if (at < 0) break;
		const liStart = i + at;
		const span = tagSpan(inner, liStart);
		items.push(inner.slice(span.innerStart, span.innerEnd));
		i = span.afterEnd;
	}
	return items;
}

// Separate a <li>'s nested lists from its inline content.
function splitLi(liHtml: string): { inline: string; nested: string[] } {
	const nested: string[] = [];
	let inline = '';
	let i = 0;
	while (i < liHtml.length) {
		if (liHtml[i] === '<') {
			const open = liHtml.slice(i).match(/^<(ul|ol)\b/i);
			if (open) {
				const span = tagSpan(liHtml, i);
				const ordered = open[1].toLowerCase() === 'ol';
				nested.push(listToMarkdown(liHtml.slice(span.innerStart, span.innerEnd), ordered));
				i = span.afterEnd;
				continue;
			}
		}
		inline += liHtml[i];
		i++;
	}
	return { inline, nested };
}

function listToMarkdown(inner: string, ordered: boolean): string {
	const lines: string[] = [];
	for (const liHtml of extractLis(inner)) {
		const { inline, nested } = splitLi(liHtml);
		const text = blocksToMarkdown(inline).trim().replace(/\n{2,}/g, '\n');
		lines.push((ordered ? '1. ' : '- ') + text);
		for (const n of nested) {
			for (const nl of n.split('\n')) lines.push(nl ? '  ' + nl : nl);
		}
	}
	return lines.join('\n');
}

// Public entry: convert a full rendered-HTML body to markdown.
function htmlToMarkdown(html: string): string {
	return blocksToMarkdown(html ?? '');
}

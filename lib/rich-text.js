// Flattens Contentful rich-text JSON documents into plain text, so the
// drafting step reads a compact body instead of the full node tree.

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading-1',
  'heading-2',
  'heading-3',
  'heading-4',
  'heading-5',
  'heading-6',
  'list-item',
  'blockquote',
  'table-row',
]);

const SKIPPED_TYPES = new Set(['embedded-entry-block', 'embedded-asset-block', 'embedded-entry-inline', 'hr']);

function collect(node, out) {
  if (!node || SKIPPED_TYPES.has(node.nodeType)) return;
  if (node.nodeType === 'text') {
    out.push(node.value || '');
    return;
  }
  const children = Array.isArray(node.content) ? node.content : [];
  if (BLOCK_TYPES.has(node.nodeType)) {
    const inner = [];
    children.forEach((child) => collect(child, inner));
    const text = inner.join('').trim();
    if (text) out.push(`\n${text}\n`);
    return;
  }
  children.forEach((child) => collect(child, out));
}

function richTextToPlain(doc, { maxChars } = {}) {
  if (!doc || typeof doc !== 'object') return '';
  const out = [];
  collect(doc, out);
  let text = out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (maxChars && text.length > maxChars) {
    text = `${text.slice(0, maxChars).trimEnd()} …[truncated]`;
  }
  return text;
}

module.exports = { richTextToPlain };

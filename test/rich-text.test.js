const test = require('node:test');
const assert = require('node:assert');
const { richTextToPlain } = require('../lib/rich-text');

const text = (value) => ({ nodeType: 'text', value, marks: [], data: {} });
const block = (nodeType, ...content) => ({ nodeType, content, data: {} });
const doc = (...content) => ({ nodeType: 'document', content, data: {} });

test('joins blocks with newlines and inline text without separators', () => {
  const d = doc(
    block('heading-2', text('Outlook')),
    block('paragraph', text('Rates are '), text('bold'), text(' today.')),
    block('unordered-list', block('list-item', block('paragraph', text('One'))), block('list-item', block('paragraph', text('Two'))))
  );
  assert.strictEqual(richTextToPlain(d), 'Outlook\nRates are bold today.\nOne\nTwo');
});

test('keeps hyperlink text and skips embedded entries/assets', () => {
  const d = doc(
    block('paragraph', text('See '), block('hyperlink', text('this report')), text('.')),
    block('embedded-entry-block', text('should not appear')),
    block('embedded-asset-block')
  );
  assert.strictEqual(richTextToPlain(d), 'See this report.');
});

test('truncates with a marker', () => {
  const d = doc(block('paragraph', text('abcdefghij')));
  assert.strictEqual(richTextToPlain(d, { maxChars: 4 }), 'abcd …[truncated]');
  assert.strictEqual(richTextToPlain(d, { maxChars: 50 }), 'abcdefghij');
});

test('handles empty or invalid input', () => {
  assert.strictEqual(richTextToPlain(null), '');
  assert.strictEqual(richTextToPlain(doc()), '');
});

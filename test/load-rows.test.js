const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadRows } = require('../scripts/export-metadata');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-rows-'));
const row = (entryId, extra = {}) => ({ entryId, slug: `s-${entryId}`, title: 'T', description: 'D', keywords: ['k'], ...extra });
const write = (name, rows) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(rows));
  return file;
};

test('accepts a single file path (backwards compatible)', () => {
  assert.strictEqual(loadRows(write('one.json', [row('a')])).length, 1);
});

test('concatenates multiple files', () => {
  const rows = loadRows([write('p1.json', [row('a'), row('b')]), write('p2.json', [row('c')])]);
  assert.deepStrictEqual(rows.map((r) => r.entryId), ['a', 'b', 'c']);
});

test('rejects duplicate entryIds across files', () => {
  assert.throws(() => loadRows([write('d1.json', [row('a')]), write('d2.json', [row('a')])]), /Duplicate entryId a/);
});

test('validates subtitle cap, canonicalUrl and schema shape', () => {
  assert.throws(() => loadRows(write('st.json', [row('a', { subtitle: 'toolong' })]), { subtitleMaxLength: 3 }), /subtitle exceeds 3/);
  assert.throws(() => loadRows(write('cu.json', [row('a', { canonicalUrl: '/insights/x' })])), /not an absolute/);
  assert.throws(() => loadRows(write('sc.json', [row('a', { schema: '{}' })])), /schema must be a JSON object/);
  assert.strictEqual(loadRows(write('ok.json', [row('a', { canonicalUrl: 'https://x.com/a', schema: { '@type': 'Article' } })])).length, 1);
});

const test = require('node:test');
const assert = require('node:assert');
const { buildCanonicalUrl, buildSchema } = require('../lib/derive');
const { deriveRow } = require('../scripts/derive-metadata');
const payden = require('../examples/payden-and-rygel/config.json');

const article = { sys: { id: 'e1' }, slug: 'q3-outlook', title: 'Q3 Outlook', publishedDate: '2026-07-01T00:00:00.000Z',
  hero: { heading: 'Q3 Outlook' }, thumbnailImage: { url: 'https://img/x.png' },
  linkedFrom: { pointOfViewPageCollection: { items: [] } } };
const povArticle = { ...article, slug: 'part-2', linkedFrom: { pointOfViewPageCollection: { items: [{ slug: 'rates' }] } } };

test('payden: plain article -> /insights/<slug>', () => {
  assert.deepStrictEqual(buildCanonicalUrl(article, payden.canonicalUrl), { url: 'https://www.payden.com/insights/q3-outlook', error: null });
});

test('payden: PoV article -> nested PoV path', () => {
  assert.strictEqual(buildCanonicalUrl(povArticle, payden.canonicalUrl).url, 'https://www.payden.com/insights/point-of-view/rates/part-2');
});

test('missing slug fails closed with an error', () => {
  const { url, error } = buildCanonicalUrl({ ...article, slug: '' }, payden.canonicalUrl);
  assert.strictEqual(url, null);
  assert.match(error, /empty token\(s\): slug/);
});

test('trailing slash option and base URL normalisation', () => {
  const cfg = { baseUrl: 'https://x.com/', default: 'a/{slug}', trailingSlash: true };
  assert.strictEqual(buildCanonicalUrl({ slug: 'b' }, cfg).url, 'https://x.com/a/b/');
});

test('schema: resolves tokens, keeps native types, drops empties', () => {
  const row = { title: 'T', description: 'Desc', keywords: ['bonds', 'rates'] };
  const schema = buildSchema({ ...article, thumbnailImage: null }, row, 'https://www.payden.com/insights/q3-outlook', payden.schema);
  assert.strictEqual(schema.description, 'Desc');
  assert.deepStrictEqual(schema.keywords, ['bonds', 'rates']);
  assert.strictEqual(schema.datePublished, '2026-07-01');
  assert.strictEqual(schema.mainEntityOfPage, 'https://www.payden.com/insights/q3-outlook');
  assert.strictEqual(schema.author[0].name, 'Payden & Rygel');
  assert.ok(!('image' in schema), 'empty image array is dropped');
});

test('schema: mixed-string tokens and filters', () => {
  const schema = buildSchema({ d: '2026-01-02T03:00Z' }, { keywords: ['a', 'b'] }, null, {
    template: { name: 'Post from {d|date}', kw: '{row.keywords|join}', missing: 'x {nope}' },
  });
  assert.deepStrictEqual(schema, { name: 'Post from 2026-01-02', kw: 'a, b' });
});

test('deriveRow: fills fields, respects existing values, flags missing entry', () => {
  const row = { entryId: 'e1', slug: 'q3-outlook', title: 'T', description: 'D', keywords: ['k'], flags: [] };
  assert.strictEqual(deriveRow(row, article, payden, { force: false }), 2);
  assert.strictEqual(row.canonicalUrl, 'https://www.payden.com/insights/q3-outlook');

  row.canonicalUrl = 'https://www.payden.com/custom';
  deriveRow(row, article, payden, { force: false });
  assert.strictEqual(row.canonicalUrl, 'https://www.payden.com/custom');
  deriveRow(row, article, payden, { force: true });
  assert.strictEqual(row.canonicalUrl, 'https://www.payden.com/insights/q3-outlook');

  const orphan = { entryId: 'zz', slug: 'x', flags: ['manual note'] };
  deriveRow(orphan, undefined, payden, { force: false });
  assert.deepStrictEqual(orphan.flags, ['manual note', 'derive: no fetched entry found for entryId zz']);
});

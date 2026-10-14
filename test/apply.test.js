const test = require('node:test');
const assert = require('node:assert');
const { createApplier, isCleanlyPublished } = require('../scripts/apply-metadata');

const seoCfg = {
  mode: 'linkedEntry',
  field: 'seoMetadata',
  titleField: 'title',
  descriptionField: 'description',
  keywordsField: 'keywords',
  createDefaults: { enableSearchEngineIndexing: true, priority: '1.0' },
};
const row = { entryId: 'page1', slug: 'my-article', title: 'T', description: 'D', keywords: ['a', 'b'] };

// In-memory Management API: records every call, stores entries, bumps versions.
function fakeApi({ page = {}, failLink = false } = {}) {
  const calls = [];
  const entries = {
    page1: {
      sys: { id: 'page1', version: 5, publishedVersion: 4, contentType: { sys: { id: 'article' } } },
      fields: { title: { 'en-US': 'Article' } },
      ...page,
    },
  };
  const contentTypes = {
    article: { fields: [{ id: 'title', localized: true }, { id: 'seoMetadata', localized: false, validations: [{ linkContentType: ['seoMetadata'] }] }] },
    seoMetadata: { fields: ['title', 'description', 'keywords', 'enableSearchEngineIndexing', 'priority'].map((id) => ({ id, localized: false })) },
  };
  const api = async (path, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ method, path, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : undefined });
    if (path === '/locales') return { items: [{ code: 'en-US', default: true }, { code: 'fr-FR' }] };
    if (path.startsWith('/content_types/')) return contentTypes[path.split('/')[2]];
    if (path === '/entries' && method === 'POST') {
      const id = 'seo-new';
      entries[id] = { sys: { id, version: 1, contentType: { sys: { id: opts.headers['X-Contentful-Content-Type'] } } }, fields: JSON.parse(opts.body).fields };
      return structuredClone(entries[id]);
    }
    const [, , id, published] = path.split('/');
    if (published === 'published') {
      entries[id].sys.publishedVersion = entries[id].sys.version;
      entries[id].sys.version += 1;
      return structuredClone(entries[id]);
    }
    if (method === 'PUT') {
      if (failLink && id === 'page1') throw new Error('409 conflict');
      entries[id].fields = JSON.parse(opts.body).fields;
      entries[id].sys.version += 1;
      return structuredClone(entries[id]);
    }
    return structuredClone(entries[id]);
  };
  return { api, calls, entries };
}

const writes = (calls) => calls.filter((c) => c.method !== 'GET');
const opts = (extra) => ({ write: false, publish: false, locale: 'en-US', createMissing: false, ...extra });

test('missing link without --create-missing fails with a hint', async () => {
  const { api } = fakeApi();
  await assert.rejects(createApplier(api).applyRow(row, seoCfg, opts()), /--create-missing/);
});

test('dry run with --create-missing makes no writes', async () => {
  const { api, calls } = fakeApi();
  await createApplier(api).applyRow(row, seoCfg, opts({ createMissing: true }));
  assert.deepStrictEqual(writes(calls), []);
});

test('creates the SEO entry with defaults, links it, and publishes nothing', async () => {
  const { api, calls, entries } = fakeApi();
  await createApplier(api).applyRow(row, seoCfg, opts({ write: true, createMissing: true, locale: 'fr-FR' }));

  const [create, link] = writes(calls);
  assert.strictEqual(create.path, '/entries');
  assert.strictEqual(create.headers['X-Contentful-Content-Type'], 'seoMetadata');
  // Non-localized fields go under the default locale even when fr-FR is requested.
  assert.deepStrictEqual(create.body.fields, {
    enableSearchEngineIndexing: { 'en-US': true },
    priority: { 'en-US': '1.0' },
    title: { 'en-US': 'T' },
    description: { 'en-US': 'D' },
    keywords: { 'en-US': ['a', 'b'] },
  });
  assert.strictEqual(link.path, '/entries/page1');
  assert.deepStrictEqual(entries.page1.fields.seoMetadata, { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: 'seo-new' } } });
  assert.deepStrictEqual(entries.page1.fields.title, { 'en-US': 'Article' }, 'other page fields are kept');
  assert.strictEqual(writes(calls).length, 2);
});

test('--publish publishes the new entry and republishes a cleanly published page', async () => {
  const { api, calls } = fakeApi();
  await createApplier(api).applyRow(row, seoCfg, opts({ write: true, publish: true, createMissing: true }));
  assert.deepStrictEqual(
    writes(calls).map((c) => c.path),
    ['/entries', '/entries/page1', '/entries/seo-new/published', '/entries/page1/published']
  );
});

test('--publish leaves a page with other pending edits unpublished', async () => {
  const { api, calls } = fakeApi({ page: { sys: { id: 'page1', version: 9, publishedVersion: 4, contentType: { sys: { id: 'article' } } } } });
  await createApplier(api).applyRow(row, seoCfg, opts({ write: true, publish: true, createMissing: true }));
  assert.deepStrictEqual(writes(calls).map((c) => c.path), ['/entries', '/entries/page1', '/entries/seo-new/published']);
});

test('an existing link takes the update path and never creates', async () => {
  const { api, calls, entries } = fakeApi({
    page: {
      sys: { id: 'page1', version: 5, contentType: { sys: { id: 'article' } } },
      fields: { seoMetadata: { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: 'seo-old' } } } },
    },
  });
  entries['seo-old'] = { sys: { id: 'seo-old', version: 3, contentType: { sys: { id: 'seoMetadata' } } }, fields: { title: { 'en-US': 'old' } } };
  await createApplier(api).applyRow(row, seoCfg, opts({ write: true, createMissing: true }));
  assert.deepStrictEqual(writes(calls).map((c) => c.path), ['/entries/seo-old']);
  assert.deepStrictEqual(entries['seo-old'].fields.title, { 'en-US': 'T' });
});

test('a failed link reports the created entry ID', async () => {
  const { api } = fakeApi({ failLink: true });
  await assert.rejects(
    createApplier(api).applyRow(row, seoCfg, opts({ write: true, createMissing: true })),
    /Created "seoMetadata" entry seo-new but failed to link it to page1/
  );
});

test('a row without a title cannot create an entry', async () => {
  const { api } = fakeApi();
  await assert.rejects(createApplier(api).applyRow({ ...row, title: '' }, seoCfg, opts({ createMissing: true })), /has no title/);
});

test('isCleanlyPublished', () => {
  assert.strictEqual(isCleanlyPublished({ sys: { version: 5, publishedVersion: 4 } }), true);
  assert.strictEqual(isCleanlyPublished({ sys: { version: 7, publishedVersion: 4 } }), false);
  assert.strictEqual(isCleanlyPublished({ sys: { version: 2 } }), false);
});

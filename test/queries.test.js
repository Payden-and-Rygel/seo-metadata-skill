const test = require('node:test');
const assert = require('node:assert');
const { buildEntryByFieldQuery, buildEntryByIdQuery, buildCollectionQuery } = require('../lib/queries');

const select = ['title', 'slug'];

for (const [name, query, field] of [
  ['by field', buildEntryByFieldQuery('Article', 'slug', select), 'articleCollection('],
  ['by id', buildEntryByIdQuery('Article', select), 'article('],
  ['collection', buildCollectionQuery('Article', select, { filterField: 'series' }), 'articleCollection('],
]) {
  test(`${name} query declares and passes preview/locale`, () => {
    assert.match(query, /\$preview: Boolean, \$locale: String/);
    const call = query.slice(query.indexOf(field));
    assert.match(call.split(')')[0], /preview: \$preview, locale: \$locale/);
  });
}

test('collection query without filter has no $value', () => {
  const q = buildCollectionQuery('Article', select);
  assert.doesNotMatch(q, /\$value/);
  assert.match(q, /skip: \$skip, limit: \$limit/);
});

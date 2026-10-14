const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('../vendor/xlsx/xlsx.mini.min.js');
const { run } = require('../scripts/export-metadata');

test('writes an xlsx that reads back with the vendored library', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-export-'));
  const input = path.join(dir, 'rows.json');
  fs.writeFileSync(input, JSON.stringify([
    { entryId: 'a', slug: 's-a', title: 'Title A', description: 'Desc A', keywords: ['k1', 'k2'] },
    { entryId: 'b', slug: 's-b', title: 'Title B', description: 'Desc B', keywords: ['k3'] },
  ]));
  run({ input: [input], format: 'xlsx', out: dir, config: path.join(dir, 'no-config.json') });

  const book = XLSX.read(fs.readFileSync(path.join(dir, 'metadata-export.xlsx')));
  const rows = XLSX.utils.sheet_to_json(book.Sheets.Metadata);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].title, 'Title A');
  assert.strictEqual(rows[0].keywords, 'k1, k2');
});

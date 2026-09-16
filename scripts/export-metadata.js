const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const REQUIRED_FIELDS = ['slug', 'title', 'description', 'keywords'];

function loadRows(inputFile) {
  const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const rows = Array.isArray(raw) ? raw : [raw];
  rows.forEach((row, i) => {
    const missing = REQUIRED_FIELDS.filter((f) => row[f] === undefined || row[f] === null);
    if (missing.length) {
      throw new Error(`Row ${i} (${row.slug || row.entryId || '?'}) is missing field(s): ${missing.join(', ')}`);
    }
    if (row.title.length > 256) {
      throw new Error(`Row ${i} (${row.slug}) title exceeds 256 chars (${row.title.length})`);
    }
    if (row.description.length > 130) {
      throw new Error(`Row ${i} (${row.slug}) description exceeds 130 chars (${row.description.length})`);
    }
  });
  return rows;
}

function toExcel(rows, outFile) {
  const sheetRows = rows.map((r) => ({
    entryId: r.entryId || '',
    slug: r.slug,
    series: r.series || '',
    title: r.title,
    titleLength: r.title.length,
    description: r.description,
    descriptionLength: r.description.length,
    keywords: Array.isArray(r.keywords) ? r.keywords.join(', ') : r.keywords,
    flags: Array.isArray(r.flags) ? r.flags.join('; ') : r.flags || '',
  }));
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Metadata');
  XLSX.writeFile(book, outFile);
}

function run(opts) {
  const rows = loadRows(opts.input);
  const outDir = opts.out || 'seo-metadata-work';
  fs.mkdirSync(outDir, { recursive: true });

  const format = opts.format || 'both';
  const written = [];

  if (format === 'json' || format === 'both') {
    const jsonFile = path.join(outDir, opts.outFile ? `${opts.outFile}.json` : 'metadata-export.json');
    fs.writeFileSync(jsonFile, JSON.stringify(rows, null, 2));
    written.push(jsonFile);
  }
  if (format === 'xlsx' || format === 'both') {
    const xlsxFile = path.join(outDir, opts.outFile ? `${opts.outFile}.xlsx` : 'metadata-export.xlsx');
    toExcel(rows, xlsxFile);
    written.push(xlsxFile);
  }

  console.error(`Exported ${rows.length} row(s) -> ${written.join(', ')}`);
}

module.exports = { run, loadRows };

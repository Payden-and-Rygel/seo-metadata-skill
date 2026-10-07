const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { loadConfig } = require('../lib/config');

const REQUIRED_FIELDS = ['slug', 'title', 'description', 'keywords'];

function readRowsFile(inputFile) {
  const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  return Array.isArray(raw) ? raw : [raw];
}

// Accepts one file or an array of files (e.g. one per fetched chunk) and
// returns the concatenated, validated rows.
function loadRows(inputFiles, rules = {}) {
  const files = Array.isArray(inputFiles) ? inputFiles : [inputFiles];
  const rows = files.flatMap(readRowsFile);
  const seenIds = new Map();
  rows.forEach((row, i) => {
    const missing = REQUIRED_FIELDS.filter((f) => row[f] === undefined || row[f] === null);
    if (missing.length) {
      throw new Error(`Row ${i} (${row.slug || row.entryId || '?'}) is missing field(s): ${missing.join(', ')}`);
    }
    if (row.entryId) {
      if (seenIds.has(row.entryId)) {
        throw new Error(`Duplicate entryId ${row.entryId} in rows ${seenIds.get(row.entryId)} and ${i} (${row.slug})`);
      }
      seenIds.set(row.entryId, i);
    }
    if (rules.titleMaxLength && row.title.length > rules.titleMaxLength) {
      throw new Error(`Row ${i} (${row.slug}) title exceeds ${rules.titleMaxLength} chars (${row.title.length})`);
    }
    if (rules.descriptionMaxLength && row.description.length > rules.descriptionMaxLength) {
      throw new Error(`Row ${i} (${row.slug}) description exceeds ${rules.descriptionMaxLength} chars (${row.description.length})`);
    }
    if (rules.subtitleMaxLength && row.subtitle && row.subtitle.length > rules.subtitleMaxLength) {
      throw new Error(`Row ${i} (${row.slug}) subtitle exceeds ${rules.subtitleMaxLength} chars (${row.subtitle.length})`);
    }
    if (row.canonicalUrl && !/^https?:\/\/[^/\s]+/.test(row.canonicalUrl)) {
      throw new Error(`Row ${i} (${row.slug}) canonicalUrl is not an absolute http(s) URL: ${row.canonicalUrl}`);
    }
    if (row.schema !== undefined && row.schema !== null && (typeof row.schema !== 'object' || Array.isArray(row.schema))) {
      throw new Error(`Row ${i} (${row.slug}) schema must be a JSON object`);
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
    subtitle: r.subtitle || '',
    subtitleLength: r.subtitle ? r.subtitle.length : '',
    description: r.description,
    descriptionLength: r.description.length,
    keywords: Array.isArray(r.keywords) ? r.keywords.join(', ') : r.keywords,
    canonicalUrl: r.canonicalUrl || '',
    schema: r.schema ? JSON.stringify(r.schema) : '',
    flags: Array.isArray(r.flags) ? r.flags.join('; ') : r.flags || '',
  }));
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Metadata');
  XLSX.writeFile(book, outFile);
}

function run(opts) {
  let rules = {};
  try {
    rules = loadConfig(opts.config).config.rules || {};
  } catch (err) {
    // Config is optional for export (only used for length-cap validation) —
    // fall back to no caps rather than forcing every project to have one.
  }

  const rows = loadRows(opts.input, rules);
  const outDir = path.resolve(opts.out || 'seo-metadata-work');
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

module.exports = { run, loadRows, readRowsFile };

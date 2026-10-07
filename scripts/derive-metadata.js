const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../lib/config');
const { buildCanonicalUrl, buildSchema } = require('../lib/derive');
const { loadRows, readRowsFile } = require('./export-metadata');

const FLAG_PREFIX = 'derive:';

function indexEntries(fetchedFiles) {
  const files = Array.isArray(fetchedFiles) ? fetchedFiles : [fetchedFiles];
  const byId = new Map();
  for (const file of files) {
    for (const entry of readRowsFile(file)) {
      if (entry && entry.sys && entry.sys.id) byId.set(entry.sys.id, entry);
    }
  }
  return byId;
}

// Fills row.canonicalUrl / row.schema in place. Returns the number of
// fields set. Problems go into row.flags rather than throwing, so one bad
// entry doesn't block the rest of the batch.
function deriveRow(row, entry, config, { force }) {
  const flags = (Array.isArray(row.flags) ? row.flags : []).filter((f) => !String(f).startsWith(FLAG_PREFIX));
  let set = 0;

  if (!entry) {
    flags.push(`${FLAG_PREFIX} no fetched entry found for entryId ${row.entryId || '(missing)'}`);
    row.flags = flags;
    return set;
  }

  if (config.canonicalUrl && (force || !row.canonicalUrl)) {
    const { url, error } = buildCanonicalUrl(entry, config.canonicalUrl);
    if (url) {
      row.canonicalUrl = url;
      set++;
    } else {
      delete row.canonicalUrl;
      flags.push(`${FLAG_PREFIX} ${error}`);
    }
  }

  if (config.schema && (force || !row.schema)) {
    const schema = buildSchema(entry, row, row.canonicalUrl, config.schema);
    if (schema) {
      row.schema = schema;
      set++;
    } else {
      flags.push(`${FLAG_PREFIX} schema template resolved empty`);
    }
  }

  row.flags = flags;
  return set;
}

function run(opts) {
  const { config } = loadConfig(opts.config);
  if (!config.canonicalUrl && !config.schema) {
    throw new Error('Config has neither "canonicalUrl" nor "schema" set — nothing to derive');
  }

  const inputs = Array.isArray(opts.input) ? opts.input : [opts.input];
  loadRows(inputs); // validates required fields + duplicate entryIds across files
  const entries = indexEntries(opts.fetched);

  const outputs = inputs.map((file) => {
    const rows = readRowsFile(file);
    const fieldsSet = rows.reduce((n, row) => n + deriveRow(row, entries.get(row.entryId), config, { force: !!opts.force }), 0);
    return { file, rows, fieldsSet };
  });

  const flagged = outputs.flatMap((o) => o.rows).filter((r) => r.flags.some((f) => f.startsWith(FLAG_PREFIX)));
  const total = outputs.reduce((n, o) => n + o.fieldsSet, 0);

  let written;
  if (opts.outFile) {
    const outDir = path.resolve(opts.out || 'seo-metadata-work');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, opts.outFile);
    fs.writeFileSync(outFile, JSON.stringify(outputs.flatMap((o) => o.rows), null, 2));
    written = [outFile];
  } else {
    outputs.forEach((o) => fs.writeFileSync(o.file, JSON.stringify(o.rows, null, 2)));
    written = outputs.map((o) => o.file);
  }

  console.error(`Derived ${total} field(s) -> ${written.join(', ')}`);
  if (flagged.length) {
    console.error(`${flagged.length} row(s) flagged:`);
    flagged.forEach((r) => {
      r.flags.filter((f) => f.startsWith(FLAG_PREFIX)).forEach((f) => console.error(`  ${r.slug}: ${f}`));
    });
  }
}

module.exports = { run, deriveRow };

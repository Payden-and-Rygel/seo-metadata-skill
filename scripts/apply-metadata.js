const { managementRequest } = require('../lib/contentful-client');
const { loadRows } = require('./export-metadata');
const { loadConfig, resolveLocale } = require('../lib/config');

const DEFAULT_LOCALE = 'en-US';

// Row key -> config key naming the Contentful field it's written to. Only
// fields that are mapped in config AND present on the row are written.
const FIELD_MAP = [
  ['title', 'titleField'],
  ['subtitle', 'subtitleField'],
  ['description', 'descriptionField'],
  ['keywords', 'keywordsField'],
  ['canonicalUrl', 'canonicalUrlField'],
  ['schema', 'schemaField'],
];

async function getEntry(entryId) {
  return managementRequest(`/entries/${entryId}`);
}

async function publishEntry(entryId, version) {
  return managementRequest(`/entries/${entryId}/published`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(version) },
  });
}

function keywordsArray(keywords) {
  return Array.isArray(keywords) ? keywords : String(keywords).split(',').map((k) => k.trim());
}

// Returns { contentfulFieldName: value } for every mapped field the row has.
function fieldValues(row, seoCfg) {
  const values = {};
  for (const [rowKey, cfgKey] of FIELD_MAP) {
    const fieldName = seoCfg[cfgKey];
    if (!fieldName || row[rowKey] === undefined || row[rowKey] === null || row[rowKey] === '') continue;
    values[fieldName] = rowKey === 'keywords' ? keywordsArray(row[rowKey]) : row[rowKey];
  }
  return values;
}

async function applyRowLinkedEntry(row, seoCfg, { write, publish, locale }) {
  const values = fieldValues(row, seoCfg);
  const articleEntry = await getEntry(row.entryId);
  const seoLink = articleEntry.fields[seoCfg.field] && articleEntry.fields[seoCfg.field][locale];
  if (!seoLink || !seoLink.sys) {
    throw new Error(
      `Entry "${row.slug}" (${row.entryId}) has no linked "${seoCfg.field}" entry yet — create one in Contentful first, this tool only updates existing entries.`
    );
  }
  const seoEntryId = seoLink.sys.id;

  if (!write) {
    console.error(`[dry run] would update linked "${seoCfg.field}" entry ${seoEntryId} for "${row.slug}" (${locale}): ${Object.keys(values).join(', ')}`);
    return;
  }

  const seoEntry = await getEntry(seoEntryId);
  for (const [fieldName, value] of Object.entries(values)) {
    seoEntry.fields[fieldName] = { ...seoEntry.fields[fieldName], [locale]: value };
  }

  const updated = await managementRequest(`/entries/${seoEntryId}`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(seoEntry.sys.version) },
    body: JSON.stringify({ fields: seoEntry.fields }),
  });
  console.error(`Updated linked "${seoCfg.field}" entry ${seoEntryId} for "${row.slug}" (${Object.keys(values).join(', ')}; draft, not published)`);

  if (publish) {
    await publishEntry(seoEntryId, updated.sys.version);
    console.error(`Published "${seoCfg.field}" entry ${seoEntryId}`);
  }
}

async function applyRowInline(row, seoCfg, { write, publish, locale }) {
  const values = fieldValues(row, seoCfg);
  if (!write) {
    console.error(`[dry run] would update inline "${seoCfg.field}" fields on ${row.entryId} for "${row.slug}" (${locale}): ${Object.keys(values).join(', ')}`);
    return;
  }

  const entry = await getEntry(row.entryId);
  const current = (entry.fields[seoCfg.field] && entry.fields[seoCfg.field][locale]) || {};
  entry.fields[seoCfg.field] = { ...entry.fields[seoCfg.field], [locale]: { ...current, ...values } };

  const updated = await managementRequest(`/entries/${row.entryId}`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(entry.sys.version) },
    body: JSON.stringify({ fields: entry.fields }),
  });
  console.error(`Updated inline "${seoCfg.field}" field on ${row.entryId} for "${row.slug}" (${Object.keys(values).join(', ')}; draft, not published)`);

  if (publish) {
    await publishEntry(row.entryId, updated.sys.version);
    console.error(`Published entry ${row.entryId}`);
  }
}

async function applyRow(row, seoCfg, opts) {
  if (!row.entryId) {
    throw new Error(`Row for slug "${row.slug}" has no entryId — cannot apply without the Contentful entry sys.id`);
  }
  if (seoCfg.mode === 'inline') {
    return applyRowInline(row, seoCfg, opts);
  }
  return applyRowLinkedEntry(row, seoCfg, opts);
}

async function run(opts) {
  const { config } = loadConfig(opts.config);
  const seoCfg = config.contentful && config.contentful.seoMetadata;
  if (!seoCfg || !seoCfg.field || !seoCfg.titleField || !seoCfg.descriptionField || !seoCfg.keywordsField) {
    throw new Error(
      'Config is missing "contentful.seoMetadata" (field, mode, titleField, descriptionField, keywordsField) — required for `apply`'
    );
  }
  const locale = resolveLocale(opts.locale, config) || DEFAULT_LOCALE;

  const rows = loadRows(opts.input, config.rules || {});

  // Always show the planned changes first, even when --write is passed.
  for (const row of rows) {
    await applyRow(row, seoCfg, { write: false, publish: false, locale });
  }
  if (!opts.write) {
    console.error('\nDry run only — no changes were made. Re-run with --write to apply (requires user approval).');
    return;
  }

  if (!(await confirmWrite(rows.length, locale, !!opts.publish, !!opts.approved))) {
    console.error('\nAborted — no changes were made to Contentful.');
    return;
  }

  for (const row of rows) {
    await applyRow(row, seoCfg, { write: true, publish: !!opts.publish, locale });
  }
}

// Nothing is ever written to Contentful without explicit user approval: either
// --approved (passed only after the user approved this exact run) or an
// interactive "yes". Non-interactive shells without --approved are refused.
async function confirmWrite(count, locale, publish, approved) {
  if (approved) return true;
  if (!process.stdin.isTTY) {
    throw new Error(
      'Refusing to write to Contentful without approval: re-run with --approved only after the user has explicitly approved this change.'
    );
  }
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolve) => {
    rl.question(
      `\nAbout to write ${count} entr${count === 1 ? 'y' : 'ies'} to Contentful (locale ${locale})${publish ? ' and PUBLISH them' : ''}. Type 'yes' to continue: `,
      resolve
    );
  });
  rl.close();
  return answer.trim() === 'yes';
}

module.exports = { run, fieldValues };

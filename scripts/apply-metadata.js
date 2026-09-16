require('dotenv').config();
const { managementRequest } = require('../lib/contentful-client');
const { loadRows } = require('./export-metadata');
const { loadConfig } = require('../lib/config');

const LOCALE = process.env.CONTENTFUL_LOCALE || 'en-US';

async function getEntry(entryId) {
  return managementRequest(`/entries/${entryId}`);
}

function setLocaleField(entry, fieldName, value) {
  entry.fields[fieldName] = { ...entry.fields[fieldName], [LOCALE]: value };
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

async function applyRowLinkedEntry(row, seoCfg, { write, publish }) {
  const articleEntry = await getEntry(row.entryId);
  const seoLink = articleEntry.fields[seoCfg.field] && articleEntry.fields[seoCfg.field][LOCALE];
  if (!seoLink || !seoLink.sys) {
    throw new Error(
      `Entry "${row.slug}" (${row.entryId}) has no linked "${seoCfg.field}" entry yet — create one in Contentful first, this tool only updates existing entries.`
    );
  }
  const seoEntryId = seoLink.sys.id;

  if (!write) {
    console.error(`[dry run] would update linked "${seoCfg.field}" entry ${seoEntryId} for "${row.slug}"`);
    return;
  }

  const seoEntry = await getEntry(seoEntryId);
  setLocaleField(seoEntry, seoCfg.titleField, row.title);
  setLocaleField(seoEntry, seoCfg.descriptionField, row.description);
  setLocaleField(seoEntry, seoCfg.keywordsField, keywordsArray(row.keywords));

  const updated = await managementRequest(`/entries/${seoEntryId}`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(seoEntry.sys.version) },
    body: JSON.stringify({ fields: seoEntry.fields }),
  });
  console.error(`Updated linked "${seoCfg.field}" entry ${seoEntryId} for "${row.slug}" (draft, not published)`);

  if (publish) {
    await publishEntry(seoEntryId, updated.sys.version);
    console.error(`Published "${seoCfg.field}" entry ${seoEntryId}`);
  }
}

async function applyRowInline(row, seoCfg, { write, publish }) {
  if (!write) {
    console.error(`[dry run] would update inline "${seoCfg.field}" fields on ${row.entryId} for "${row.slug}"`);
    return;
  }

  const entry = await getEntry(row.entryId);
  const current = (entry.fields[seoCfg.field] && entry.fields[seoCfg.field][LOCALE]) || {};
  const nextValue = {
    ...current,
    [seoCfg.titleField]: row.title,
    [seoCfg.descriptionField]: row.description,
    [seoCfg.keywordsField]: keywordsArray(row.keywords),
  };
  entry.fields[seoCfg.field] = { ...entry.fields[seoCfg.field], [LOCALE]: nextValue };

  const updated = await managementRequest(`/entries/${row.entryId}`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(entry.sys.version) },
    body: JSON.stringify({ fields: entry.fields }),
  });
  console.error(`Updated inline "${seoCfg.field}" field on ${row.entryId} for "${row.slug}" (draft, not published)`);

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

  const rows = loadRows(opts.input, config.rules || {});
  for (const row of rows) {
    await applyRow(row, seoCfg, { write: !!opts.write, publish: !!opts.publish });
  }
  if (!opts.write) {
    console.error('\nDry run only — no changes were made. Re-run with --write to apply.');
  }
}

module.exports = { run };

require('dotenv').config();
const fs = require('fs');
const { managementRequest } = require('../lib/contentful-client');
const { loadRows } = require('./export-metadata');

const LOCALE = process.env.CONTENTFUL_LOCALE || 'en-US';

async function getEntry(entryId) {
  return managementRequest(`/entries/${entryId}`);
}

async function updateSeoMetadataEntry(seoEntryId, { title, description, keywords }) {
  const entry = await getEntry(seoEntryId);
  entry.fields.title = { ...entry.fields.title, [LOCALE]: title };
  entry.fields.description = { ...entry.fields.description, [LOCALE]: description };
  entry.fields.keywords = {
    ...entry.fields.keywords,
    [LOCALE]: Array.isArray(keywords) ? keywords : String(keywords).split(',').map((k) => k.trim()),
  };

  return managementRequest(`/entries/${seoEntryId}`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(entry.sys.version) },
    body: JSON.stringify({ fields: entry.fields }),
  });
}

async function publishEntry(entryId, version) {
  return managementRequest(`/entries/${entryId}/published`, {
    method: 'PUT',
    headers: { 'X-Contentful-Version': String(version) },
  });
}

async function applyRow(row, { write, publish }) {
  if (!row.entryId) {
    throw new Error(`Row for slug "${row.slug}" has no entryId — cannot apply without the Contentful entry sys.id`);
  }

  const articleEntry = await getEntry(row.entryId);
  const seoLink = articleEntry.fields.seoMetadata && articleEntry.fields.seoMetadata[LOCALE];
  if (!seoLink || !seoLink.sys) {
    throw new Error(
      `Article "${row.slug}" (${row.entryId}) has no linked seoMetadata entry yet — create one in Contentful first, this tool only updates existing entries.`
    );
  }
  const seoEntryId = seoLink.sys.id;

  if (!write) {
    console.error(`[dry run] would update seoMetadata entry ${seoEntryId} for "${row.slug}"`);
    return;
  }

  const updated = await updateSeoMetadataEntry(seoEntryId, row);
  console.error(`Updated seoMetadata entry ${seoEntryId} for "${row.slug}" (draft, not published)`);

  if (publish) {
    await publishEntry(seoEntryId, updated.sys.version);
    console.error(`Published seoMetadata entry ${seoEntryId}`);
  }
}

async function run(opts) {
  const rows = loadRows(opts.input);
  for (const row of rows) {
    await applyRow(row, { write: !!opts.write, publish: !!opts.publish });
  }
  if (!opts.write) {
    console.error('\nDry run only — no changes were made. Re-run with --write to apply.');
  }
}

module.exports = { run };

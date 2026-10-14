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

// An entry is "cleanly published" when it's published and has no edits since:
// Contentful bumps sys.version by one on publish, so version === publishedVersion + 1.
function isCleanlyPublished(entry) {
  return !!entry.sys.publishedVersion && entry.sys.version === entry.sys.publishedVersion + 1;
}

// All Management API access goes through `api` (managementRequest by default)
// so tests can pass a fake. Content types and the default locale are cached.
function createApplier(api = managementRequest) {
  const contentTypes = new Map();
  let defaultLocaleCode;

  const getEntry = (id) => api(`/entries/${id}`);

  async function getContentType(id) {
    if (!contentTypes.has(id)) contentTypes.set(id, await api(`/content_types/${id}`));
    return contentTypes.get(id);
  }

  async function defaultLocale() {
    if (defaultLocaleCode === undefined) {
      const { items } = await api('/locales');
      const found = items.find((l) => l.default);
      defaultLocaleCode = found ? found.code : DEFAULT_LOCALE;
    }
    return defaultLocaleCode;
  }

  // Non-localized fields are always stored under the space's default locale.
  async function fieldLocale(contentTypeId, fieldId, locale) {
    const field = (await getContentType(contentTypeId)).fields.find((f) => f.id === fieldId);
    return field && field.localized ? locale : defaultLocale();
  }

  async function localizeFields(contentTypeId, values, locale) {
    const fields = {};
    for (const [fieldId, value] of Object.entries(values)) {
      fields[fieldId] = { [await fieldLocale(contentTypeId, fieldId, locale)]: value };
    }
    return fields;
  }

  async function publishEntry(entryId, version) {
    return api(`/entries/${entryId}/published`, {
      method: 'PUT',
      headers: { 'X-Contentful-Version': String(version) },
    });
  }

  // The content type a new SEO entry is created as: config override, else the
  // single type the page's link field accepts.
  async function seoContentType(pageTypeId, seoCfg) {
    if (seoCfg.contentType) return seoCfg.contentType;
    const field = (await getContentType(pageTypeId)).fields.find((f) => f.id === seoCfg.field);
    const allowed = ((field && field.validations) || []).flatMap((v) => v.linkContentType || []);
    if (allowed.length !== 1) {
      throw new Error(
        `Can't tell which content type to create for "${seoCfg.field}" on ${pageTypeId} (allowed: ${allowed.join(', ') || 'any'}). Set contentful.seoMetadata.contentType in config.`
      );
    }
    return allowed[0];
  }

  async function createAndLink(row, page, linkLocale, seoCfg, { write, publish, locale }) {
    const pageTypeId = page.sys.contentType.sys.id;
    const typeId = await seoContentType(pageTypeId, seoCfg);
    if (!row.title) {
      throw new Error(`Row for "${row.slug}" (${row.entryId}) has no title — required to create a new "${typeId}" entry.`);
    }
    const defaults = seoCfg.createDefaults || {};
    const values = { ...defaults, ...fieldValues(row, seoCfg) };
    const pageClean = isCleanlyPublished(page);
    const pagePlan = !publish
      ? 'page left as draft change'
      : pageClean
        ? 'new entry published and page republished'
        : 'new entry published; page has other unpublished edits, so it stays a draft change';

    if (!write) {
      console.error(
        `[dry run] would CREATE "${typeId}" entry for "${row.slug}" (${Object.keys(values).join(', ')}) and LINK it to ${pageTypeId} ${row.entryId} via "${seoCfg.field}"; ${pagePlan}`
      );
      return;
    }

    const created = await api('/entries', {
      method: 'POST',
      headers: { 'X-Contentful-Content-Type': typeId },
      body: JSON.stringify({ fields: await localizeFields(typeId, values, locale) }),
    });
    const seoEntryId = created.sys.id;
    console.error(`Created "${typeId}" entry ${seoEntryId} for "${row.slug}" (draft)`);

    let linked;
    try {
      const fresh = await getEntry(row.entryId);
      fresh.fields[seoCfg.field] = { [linkLocale]: { sys: { type: 'Link', linkType: 'Entry', id: seoEntryId } } };
      linked = await api(`/entries/${row.entryId}`, {
        method: 'PUT',
        headers: { 'X-Contentful-Version': String(fresh.sys.version) },
        body: JSON.stringify({ fields: fresh.fields }),
      });
    } catch (err) {
      throw new Error(
        `Created "${typeId}" entry ${seoEntryId} but failed to link it to ${row.entryId} ("${row.slug}"): ${err.message}. Link it by hand in Contentful, or delete it.`
      );
    }
    console.error(`Linked ${seoEntryId} to ${pageTypeId} ${row.entryId} via "${seoCfg.field}" (draft change)`);

    if (publish) {
      await publishEntry(seoEntryId, created.sys.version);
      console.error(`Published "${typeId}" entry ${seoEntryId}`);
      if (pageClean) {
        await publishEntry(row.entryId, linked.sys.version);
        console.error(`Republished ${pageTypeId} ${row.entryId} with the new link`);
      } else {
        console.error(
          `Left ${pageTypeId} ${row.entryId} ("${row.slug}") unpublished: it had other unpublished edits. Publish it in Contentful when ready.`
        );
      }
    }
  }

  async function applyRowLinkedEntry(row, seoCfg, opts) {
    const { write, publish, locale, createMissing } = opts;
    const page = await getEntry(row.entryId);
    const linkLocale = await fieldLocale(page.sys.contentType.sys.id, seoCfg.field, locale);
    const seoLink = page.fields[seoCfg.field] && page.fields[seoCfg.field][linkLocale];
    if (!seoLink || !seoLink.sys) {
      if (createMissing) return createAndLink(row, page, linkLocale, seoCfg, opts);
      throw new Error(
        `Entry "${row.slug}" (${row.entryId}) has no linked "${seoCfg.field}" entry yet. Re-run with --create-missing to create and link one.`
      );
    }
    const seoEntryId = seoLink.sys.id;
    const values = fieldValues(row, seoCfg);

    if (!write) {
      console.error(`[dry run] would update linked "${seoCfg.field}" entry ${seoEntryId} for "${row.slug}" (${locale}): ${Object.keys(values).join(', ')}`);
      return;
    }

    const seoEntry = await getEntry(seoEntryId);
    const seoTypeId = seoEntry.sys.contentType.sys.id;
    for (const [fieldName, value] of Object.entries(values)) {
      seoEntry.fields[fieldName] = { ...seoEntry.fields[fieldName], [await fieldLocale(seoTypeId, fieldName, locale)]: value };
    }

    const updated = await api(`/entries/${seoEntryId}`, {
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
    const fieldLoc = await fieldLocale(entry.sys.contentType.sys.id, seoCfg.field, locale);
    const current = (entry.fields[seoCfg.field] && entry.fields[seoCfg.field][fieldLoc]) || {};
    entry.fields[seoCfg.field] = { ...entry.fields[seoCfg.field], [fieldLoc]: { ...current, ...values } };

    const updated = await api(`/entries/${row.entryId}`, {
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

  return { applyRow };
}

async function run(opts, api = managementRequest) {
  const { config } = loadConfig(opts.config);
  const seoCfg = config.contentful && config.contentful.seoMetadata;
  if (!seoCfg || !seoCfg.field || !seoCfg.titleField || !seoCfg.descriptionField || !seoCfg.keywordsField) {
    throw new Error(
      'Config is missing "contentful.seoMetadata" (field, mode, titleField, descriptionField, keywordsField) — required for `apply`'
    );
  }
  if (opts.createMissing && seoCfg.mode === 'inline') {
    throw new Error('--create-missing only applies to "linkedEntry" mode; inline SEO fields are always on the entry itself.');
  }
  const locale = resolveLocale(opts.locale, config) || DEFAULT_LOCALE;
  const createMissing = !!opts.createMissing;
  const { applyRow } = createApplier(api);

  const rows = loadRows(opts.input, config.rules || {});

  // Always show the planned changes first, even when --write is passed.
  for (const row of rows) {
    await applyRow(row, seoCfg, { write: false, publish: !!opts.publish, locale, createMissing });
  }
  if (!opts.write) {
    console.error('\nDry run only — no changes were made. Re-run with --write to apply (requires user approval).');
    return;
  }

  if (!(await confirmWrite(rows.length, locale, !!opts.publish, !!opts.approved, createMissing))) {
    console.error('\nAborted — no changes were made to Contentful.');
    return;
  }

  for (const row of rows) {
    await applyRow(row, seoCfg, { write: true, publish: !!opts.publish, locale, createMissing });
  }
}

// Nothing is ever written to Contentful without explicit user approval: either
// --approved (passed only after the user approved this exact run) or an
// interactive "yes". Non-interactive shells without --approved are refused.
async function confirmWrite(count, locale, publish, approved, createMissing) {
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
      `\nAbout to write ${count} entr${count === 1 ? 'y' : 'ies'} to Contentful (locale ${locale})` +
        `${createMissing ? ', creating and linking missing SEO entries' : ''}${publish ? ' and PUBLISH them' : ''}. Type 'yes' to continue: `,
      resolve
    );
  });
  rl.close();
  return answer.trim() === 'yes';
}

module.exports = { run, fieldValues, createApplier, isCleanlyPublished };

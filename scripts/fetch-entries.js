const fs = require('fs');
const path = require('path');
const { graphql } = require('../lib/contentful-client');
const {
  entryFieldName,
  collectionFieldName,
  buildEntryByFieldQuery,
  buildEntryByIdQuery,
  buildCollectionQuery,
} = require('../lib/queries');
const { loadConfig, resolveLocale } = require('../lib/config');
const { getByPath, deleteByPath, isEmpty } = require('../lib/object-path');
const { richTextToPlain } = require('../lib/rich-text');

const PAGE_SIZE = 50;

async function paginate(query, variables, collectionField, ctx, { limit } = {}) {
  const items = [];
  let skip = 0;
  for (;;) {
    const pageSize = limit ? Math.min(PAGE_SIZE, limit - items.length) : PAGE_SIZE;
    const data = await graphql(query, { ...variables, ...ctx.vars, skip, limit: pageSize }, ctx.gqlOpts);
    items.push(...data[collectionField].items);
    skip += pageSize;
    if (skip >= data[collectionField].total || (limit && items.length >= limit)) break;
  }
  return items;
}

async function fetchBySlug(cfg, slug, ctx) {
  const query = buildEntryByFieldQuery(cfg.contentType, cfg.fields.slug, cfg.fields.select);
  const data = await graphql(query, { value: slug, ...ctx.vars }, ctx.gqlOpts);
  return data[collectionFieldName(cfg.contentType)].items;
}

async function fetchById(cfg, id, ctx) {
  const query = buildEntryByIdQuery(cfg.contentType, cfg.fields.select);
  const fieldName = entryFieldName(cfg.contentType);
  const data = await graphql(query, { id, ...ctx.vars }, ctx.gqlOpts);
  return data[fieldName] ? [data[fieldName]] : [];
}

async function fetchBySeriesLikeField(cfg, value, ctx, opts) {
  if (!cfg.fields.series) {
    throw new Error('Config has no "contentful.fields.series" set — cannot filter by --series');
  }
  const query = buildCollectionQuery(cfg.contentType, cfg.fields.select, { filterField: cfg.fields.series });
  return paginate(query, { value }, collectionFieldName(cfg.contentType), ctx, opts);
}

async function fetchAll(cfg, ctx, opts) {
  const query = buildCollectionQuery(cfg.contentType, cfg.fields.select);
  return paginate(query, {}, collectionFieldName(cfg.contentType), ctx, opts);
}

async function fetchHub(cfg, slug, ctx) {
  if (!cfg.hubContentType || !cfg.hubFields) {
    throw new Error(
      'Config has no "contentful.hubContentType"/"contentful.hubFields" set — --hub-slug is not available for this project'
    );
  }
  const query = buildEntryByFieldQuery(cfg.hubContentType, cfg.hubFields.slug || cfg.fields.slug, cfg.hubFields.select);
  const data = await graphql(query, { value: slug, ...ctx.vars }, ctx.gqlOpts);
  return data[collectionFieldName(cfg.hubContentType)].items;
}

function toList(value) {
  return (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
}

// Fetches each slug/ID in turn, dropping duplicates by sys.id. A value that
// matches nothing is reported but doesn't fail the rest of the batch.
async function fetchMany(values, fetchOne) {
  const items = [];
  const seen = new Set();
  for (const value of values) {
    const found = await fetchOne(value);
    if (!found.length) console.error(`Not found: ${value}`);
    for (const item of found) {
      const id = item.sys && item.sys.id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      items.push(item);
    }
  }
  return items;
}

function filterMissing(items, cfg) {
  const seo = cfg.seoMetadata;
  if (!seo || !seo.field) {
    throw new Error('Config has no "contentful.seoMetadata.field" set — cannot use --only-missing');
  }
  const checkFields = seo.missingCheckFields || [seo.titleField, seo.descriptionField];
  return items.filter((item) => {
    const seoValue = item[seo.field];
    if (!seoValue) return true;
    return checkFields.some((f) => !getByPath(seoValue, f));
  });
}

// Replaces each configured rich-text path (e.g. "content.json") with a
// plain-text rendering under item._plainText[path], to keep the drafting
// input small.
function flattenRichText(items, fieldsCfg, { keepRichText }) {
  const paths = fieldsCfg.richText || [];
  if (!paths.length) return;
  for (const item of items) {
    const plain = {};
    for (const p of paths) {
      const doc = getByPath(item, p);
      if (doc == null) continue;
      plain[p] = richTextToPlain(doc, { maxChars: fieldsCfg.plainTextMaxChars });
      if (!keepRichText) {
        deleteByPath(item, p);
        // Drop the now-empty wrapper too, e.g. "content" after removing "content.json".
        const parentPath = p.split('.').slice(0, -1).join('.');
        if (parentPath && isEmpty(getByPath(item, parentPath))) deleteByPath(item, parentPath);
      }
    }
    if (Object.keys(plain).length) item._plainText = plain;
  }
}

function writeOutput(items, opts) {
  const outDir = path.resolve(opts.out || 'seo-metadata-work');
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = opts.outFile || 'fetched-entries.json';
  const chunkSize = opts.chunkSize ? parseInt(opts.chunkSize, 10) : 0;

  if (!chunkSize || items.length <= chunkSize) {
    const outFile = path.join(outDir, baseName);
    fs.writeFileSync(outFile, JSON.stringify(items, null, 2));
    return [outFile];
  }

  const ext = path.extname(baseName) || '.json';
  const stem = path.basename(baseName, ext);
  const files = [];
  for (let i = 0; i * chunkSize < items.length; i++) {
    const outFile = path.join(outDir, `${stem}.part-${String(i + 1).padStart(3, '0')}${ext}`);
    fs.writeFileSync(outFile, JSON.stringify(items.slice(i * chunkSize, (i + 1) * chunkSize), null, 2));
    files.push(outFile);
  }
  return files;
}

async function run(opts) {
  const { config, configDir } = loadConfig(opts.config);
  const cfg = config.contentful;
  const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
  const ctx = {
    vars: { preview: !!opts.preview, locale: resolveLocale(opts.locale, config) },
    gqlOpts: { preview: !!opts.preview },
  };

  let items;
  if (opts.slug) {
    items = await fetchMany(toList(opts.slug), (slug) => fetchBySlug(cfg, slug, ctx));
  } else if (opts.entryId) {
    items = await fetchMany(toList(opts.entryId), (id) => fetchById(cfg, id, ctx));
  } else if (opts.hubSlug) {
    items = await fetchHub(cfg, opts.hubSlug, ctx);
  } else if (opts.series) {
    // With --only-missing, the limit applies after filtering, so fetch everything first.
    items = await fetchBySeriesLikeField(cfg, opts.series, ctx, { limit: opts.onlyMissing ? undefined : limit });
  } else if (opts.all) {
    items = await fetchAll(cfg, ctx, { limit: opts.onlyMissing ? undefined : limit });
  } else {
    throw new Error('Specify one of --slug, --entry-id, --hub-slug, --series, or --all');
  }

  if (opts.onlyMissing) items = filterMissing(items, cfg);
  if (limit) items = items.slice(0, limit);

  if (items.length === 0) {
    console.error('No matching entries found.');
    process.exitCode = 1;
    return;
  }

  flattenRichText(items, cfg.fields, { keepRichText: !!opts.keepRichText });
  const files = writeOutput(items, opts);

  console.error(`Fetched ${items.length} entr${items.length === 1 ? 'y' : 'ies'} -> ${files.join(', ')}`);
  console.error(`Next: read ${files.length > 1 ? 'each chunk' : 'this file'} and draft metadata per your configured rules (see ${configDir}), then run \`derive\` and \`export\`.`);
}

module.exports = { run, filterMissing, flattenRichText };

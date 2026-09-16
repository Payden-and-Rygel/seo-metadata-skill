require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { graphql } = require('../lib/contentful-client');
const { buildEntryByFieldQuery, buildEntryByIdQuery, buildCollectionQuery } = require('../lib/queries');
const { loadConfig } = require('../lib/config');

const PAGE_SIZE = 50;

function getByPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

async function fetchBySlug(cfg, slug) {
  const query = buildEntryByFieldQuery(cfg.contentType, cfg.fields.slug, cfg.fields.select);
  const data = await graphql(query, { value: slug });
  const collectionField = `${cfg.contentType}Collection`;
  return data[collectionField].items;
}

async function fetchById(cfg, id) {
  const query = buildEntryByIdQuery(cfg.contentType, cfg.fields.select);
  const fieldName = cfg.contentType.charAt(0).toLowerCase() + cfg.contentType.slice(1);
  const data = await graphql(query, { id });
  return data[fieldName] ? [data[fieldName]] : [];
}

async function fetchBySeriesLikeField(cfg, value) {
  if (!cfg.fields.series) {
    throw new Error('Config has no "contentful.fields.series" set — cannot filter by --series');
  }
  const query = buildCollectionQuery(cfg.contentType, cfg.fields.select, { filterField: cfg.fields.series });
  const collectionField = `${cfg.contentType}Collection`;
  const items = [];
  let skip = 0;
  for (;;) {
    const data = await graphql(query, { value, skip, limit: PAGE_SIZE });
    items.push(...data[collectionField].items);
    skip += PAGE_SIZE;
    if (skip >= data[collectionField].total) break;
  }
  return items;
}

async function fetchAll(cfg, { onlyMissing }) {
  const query = buildCollectionQuery(cfg.contentType, cfg.fields.select);
  const collectionField = `${cfg.contentType}Collection`;
  const items = [];
  let skip = 0;
  for (;;) {
    const data = await graphql(query, { skip, limit: PAGE_SIZE });
    items.push(...data[collectionField].items);
    skip += PAGE_SIZE;
    if (skip >= data[collectionField].total) break;
  }
  if (onlyMissing) {
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
  return items;
}

async function fetchHub(cfg, slug) {
  if (!cfg.hubContentType || !cfg.hubFields) {
    throw new Error(
      'Config has no "contentful.hubContentType"/"contentful.hubFields" set — --hub-slug is not available for this project'
    );
  }
  const query = buildEntryByFieldQuery(cfg.hubContentType, cfg.hubFields.slug || cfg.fields.slug, cfg.hubFields.select);
  const data = await graphql(query, { value: slug });
  const collectionField = `${cfg.hubContentType}Collection`;
  return data[collectionField].items;
}

async function run(opts) {
  const { config, configDir } = loadConfig(opts.config);
  const cfg = config.contentful;

  let items;
  if (opts.slug) {
    items = await fetchBySlug(cfg, opts.slug);
  } else if (opts.entryId) {
    items = await fetchById(cfg, opts.entryId);
  } else if (opts.hubSlug) {
    items = await fetchHub(cfg, opts.hubSlug);
  } else if (opts.series) {
    items = await fetchBySeriesLikeField(cfg, opts.series);
  } else if (opts.all) {
    items = await fetchAll(cfg, { onlyMissing: opts.onlyMissing });
  } else {
    throw new Error('Specify one of --slug, --entry-id, --hub-slug, --series, or --all');
  }

  if (items.length === 0) {
    console.error('No matching entries found.');
    process.exitCode = 1;
    return;
  }

  const outDir = path.resolve(opts.out || 'seo-metadata-work');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, opts.outFile || 'fetched-entries.json');
  fs.writeFileSync(outFile, JSON.stringify(items, null, 2));

  console.error(`Fetched ${items.length} entr${items.length === 1 ? 'y' : 'ies'} -> ${outFile}`);
  console.error(`Next: read this file and draft Title/Description/Keywords per your configured rules (see ${configDir}), then run \`export\`.`);
}

module.exports = { run };

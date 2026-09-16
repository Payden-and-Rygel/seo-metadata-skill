require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { graphql } = require('../lib/contentful-client');
const {
  ARTICLE_BY_SLUG,
  ARTICLE_BY_ID,
  ARTICLES_BY_SERIES,
  ARTICLES_MISSING_METADATA,
  POINT_OF_VIEW_HUB,
} = require('../lib/queries');

const PAGE_SIZE = 50;

async function fetchBySlug(slug) {
  const data = await graphql(ARTICLE_BY_SLUG, { slug });
  return data.articleCollection.items;
}

async function fetchById(id) {
  const data = await graphql(ARTICLE_BY_ID, { id });
  return data.article ? [data.article] : [];
}

async function fetchBySeries(series) {
  const items = [];
  let skip = 0;
  for (;;) {
    const data = await graphql(ARTICLES_BY_SERIES, { series, skip, limit: PAGE_SIZE });
    items.push(...data.articleCollection.items);
    skip += PAGE_SIZE;
    if (skip >= data.articleCollection.total) break;
  }
  return items;
}

async function fetchAll({ onlyMissing }) {
  const items = [];
  let skip = 0;
  for (;;) {
    const data = await graphql(ARTICLES_MISSING_METADATA, { skip, limit: PAGE_SIZE });
    items.push(...data.articleCollection.items);
    skip += PAGE_SIZE;
    if (skip >= data.articleCollection.total) break;
  }
  if (onlyMissing) {
    return items.filter(
      (item) => !item.seoMetadata || !item.seoMetadata.title || !item.seoMetadata.description
    );
  }
  return items;
}

async function fetchHub(slug) {
  const data = await graphql(POINT_OF_VIEW_HUB, { slug });
  return data.pointOfViewPageCollection.items;
}

async function run(opts) {
  let items;
  if (opts.slug) {
    items = await fetchBySlug(opts.slug);
  } else if (opts.entryId) {
    items = await fetchById(opts.entryId);
  } else if (opts.hubSlug) {
    items = await fetchHub(opts.hubSlug);
  } else if (opts.series) {
    items = await fetchBySeries(opts.series);
  } else if (opts.all) {
    items = await fetchAll({ onlyMissing: opts.onlyMissing });
  } else {
    throw new Error('Specify one of --slug, --entry-id, --hub-slug, --series, or --all');
  }

  if (items.length === 0) {
    console.error('No matching entries found.');
    process.exitCode = 1;
    return;
  }

  const outDir = opts.out || 'seo-metadata-work';
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, opts.outFile || 'fetched-entries.json');
  fs.writeFileSync(outFile, JSON.stringify(items, null, 2));

  console.error(`Fetched ${items.length} entr${items.length === 1 ? 'y' : 'ies'} -> ${outFile}`);
  console.error('Next: read this file and draft Title/Description/Keywords per SKILL.md, then run `export`.');
}

module.exports = { run };

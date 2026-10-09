#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();

program
  .name('seo-metadata-skill')
  .description('Fetch Contentful entries, and export/apply generated SEO metadata. Requires a project-specific config file — see config.example.json.');

program
  .command('fetch')
  .description('Fetch one or more Contentful entries and write raw JSON for metadata generation')
  .option('--config <path>', 'path to your seo-metadata.config.json (default: ./seo-metadata.config.json)')
  .option('--slug <slug>', 'fetch a single entry by slug')
  .option('--entry-id <id>', 'fetch a single entry by Contentful entry ID')
  .option('--hub-slug <slug>', 'fetch a hub/landing entry by slug, with its configured hubFields selection')
  .option('--series <value>', 'fetch all entries matching the configured "fields.series" value')
  .option('--all', 'fetch every entry of the configured content type')
  .option('--only-missing', 'keep only entries missing the configured SEO metadata fields')
  .option('--limit <n>', 'return at most n entries')
  .option('--preview', 'read draft content via the Content Preview API (needs CONTENTFUL_PREVIEW_TOKEN)')
  .option('--locale <code>', 'Contentful locale to fetch (default: config contentful.locale, then CONTENTFUL_LOCALE)')
  .option('--keep-rich-text', 'keep raw rich-text JSON alongside the _plainText rendering')
  .option('--chunk-size <n>', 'split output into files of n entries each (<name>.part-001.json, ...)')
  .option('--out <dir>', 'output directory (default: seo-metadata-work)')
  .option('--out-file <name>', 'output filename (default: fetched-entries.json)')
  .action(async (opts) => {
    try {
      await require('../scripts/fetch-entries').run(opts);
    } catch (err) {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  });

program
  .command('derive')
  .description('Fill in canonicalUrl and schema on generated metadata rows from the config templates and fetched entries')
  .requiredOption('--input <files...>', 'JSON file(s) of generated metadata rows (updated in place unless --out-file)')
  .requiredOption('--fetched <files...>', 'fetched-entries JSON file(s) the rows were drafted from')
  .option('--config <path>', 'path to your seo-metadata.config.json (default: ./seo-metadata.config.json)')
  .option('--force', 'recompute canonicalUrl/schema even if a row already has them')
  .option('--out <dir>', 'output directory for --out-file (default: seo-metadata-work)')
  .option('--out-file <name>', 'write all rows to this single file instead of updating inputs in place')
  .action((opts) => {
    try {
      require('../scripts/derive-metadata').run(opts);
    } catch (err) {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  });

program
  .command('export')
  .description('Export generated metadata rows (JSON array of {entryId, slug, title, description, keywords, ...}) to JSON/Excel')
  .requiredOption('--input <files...>', 'JSON file(s) of generated metadata rows')
  .option('--config <path>', 'path to your seo-metadata.config.json, used for length-cap validation (optional)')
  .option('--format <format>', 'json | xlsx | both', 'both')
  .option('--out <dir>', 'output directory (default: seo-metadata-work)')
  .option('--out-file <name>', 'output filename without extension (default: metadata-export)')
  .action((opts) => {
    try {
      require('../scripts/export-metadata').run(opts);
    } catch (err) {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  });

program
  .command('apply')
  .description('Apply generated metadata rows to Contentful via the Management API (dry run unless --write)')
  .requiredOption('--input <files...>', 'JSON file(s) of generated metadata rows (must include entryId)')
  .option('--config <path>', 'path to your seo-metadata.config.json (default: ./seo-metadata.config.json)')
  .option('--locale <code>', 'Contentful locale to write (default: config contentful.locale, then CONTENTFUL_LOCALE, then en-US)')
  .option('--write', 'actually write to Contentful (default is dry run)')
  .option('--publish', 'also publish the updated entry (implies --write)')
  .option('--approved', 'confirm the user explicitly approved this write; required for --write/--publish in non-interactive shells')
  .action(async (opts) => {
    try {
      await require('../scripts/apply-metadata').run({ ...opts, write: opts.write || opts.publish });
    } catch (err) {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);

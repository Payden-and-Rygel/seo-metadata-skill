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
  .option('--only-missing', 'with --all, keep only entries missing the configured SEO metadata fields')
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
  .command('export')
  .description('Export generated metadata rows (JSON array of {entryId, slug, title, description, keywords}) to JSON/Excel')
  .requiredOption('--input <file>', 'JSON file of generated metadata rows')
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
  .requiredOption('--input <file>', 'JSON file of generated metadata rows (must include entryId)')
  .option('--config <path>', 'path to your seo-metadata.config.json (default: ./seo-metadata.config.json)')
  .option('--write', 'actually write to Contentful (default is dry run)')
  .option('--publish', 'also publish the updated entry (implies --write)')
  .action(async (opts) => {
    try {
      await require('../scripts/apply-metadata').run({ ...opts, write: opts.write || opts.publish });
    } catch (err) {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);

#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();

program
  .name('seo-metadata-skill')
  .description('Fetch Contentful article entries, and export/apply generated SEO metadata.');

program
  .command('fetch')
  .description('Fetch one or more Contentful entries and write raw JSON for metadata generation')
  .option('--slug <slug>', 'fetch a single Article by slug')
  .option('--entry-id <id>', 'fetch a single Article by Contentful entry ID')
  .option('--hub-slug <slug>', 'fetch a PointOfViewPage hub entry by slug, with its linked articles')
  .option('--series <series>', 'fetch all Articles in a series (e.g. "Week in Review")')
  .option('--all', 'fetch every Article entry')
  .option('--only-missing', 'with --all, keep only entries missing seoMetadata title/description')
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
  .option('--write', 'actually write to Contentful (default is dry run)')
  .option('--publish', 'also publish the updated seoMetadata entry (implies --write)')
  .action(async (opts) => {
    try {
      await require('../scripts/apply-metadata').run({ ...opts, write: opts.write || opts.publish });
    } catch (err) {
      console.error('Error:', err.message);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);

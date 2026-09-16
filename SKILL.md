---
name: seo-metadata
description: Generate SEO metadata (Title/Description/Keywords) for Contentful entries per a project-specific config and rule set, and export the result to JSON/Excel or apply it back to Contentful. Use when asked to fill in missing/generate CMS SEO metadata, audit entries' metadata fields, or export metadata for review. Requires a project config file (see config.example.json) — not usable out of the box against an arbitrary Contentful space until one is set up.
---

# SEO metadata generator (Contentful)

Generates the SEO metadata fields — Title, Description, Keywords — for Contentful entries. This skill is **generic**: it has no built-in knowledge of any particular Contentful space's content types, field names, or editorial rules. All of that comes from a config file and a set of rule documents you supply per project.

This skill's scripts do the mechanical *fetching* and *exporting*. **You (Claude) do the actual drafting** by reading the fetched content and applying the project's rule docs — this is judgment work, not a template fill-in a script could do reliably.

## Setup (one-time, per project)

```
cd seo-metadata-skill
npm install
cp .env.example .env                                # fill in CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN
cp config.example.json ./seo-metadata.config.json    # describe this project's Contentful schema
mkdir -p rules && cp rules/*.template.md ./rules/    # then rename, dropping .template, and fill in
```

If a config for this exact project already exists under `examples/` (check there first), copy that instead of starting from the blank template — see `examples/payden-and-rygel/` for what a filled-in example looks like.

`seo-metadata.config.json` must define, at minimum:
- `contentful.contentType` — the Contentful content type ID to query.
- `contentful.fields.slug` — the field used to look up an entry by slug.
- `contentful.fields.select` — the GraphQL field selections to fetch (raw snippets, e.g. `"hero { image { url } }"`).
- `contentful.seoMetadata` — how the SEO fields are stored (a linked entry, or inline on the entry itself) and their field names, required for `apply`.

`CONTENTFUL_MANAGEMENT_TOKEN` is only needed for the optional `apply --write` step.

## Workflow

### 1. Fetch entries

```
node bin/seo-metadata-skill.js fetch --slug <slug>
node bin/seo-metadata-skill.js fetch --entry-id <id>
node bin/seo-metadata-skill.js fetch --series <value>       # requires contentful.fields.series in config
node bin/seo-metadata-skill.js fetch --all --only-missing
node bin/seo-metadata-skill.js fetch --hub-slug <slug>       # requires contentful.hubContentType in config
```

All commands accept `--config <path>` if your config isn't at `./seo-metadata.config.json`.

Writes the raw entry JSON (whatever fields your config selected) to `seo-metadata-work/fetched-entries.json`.

### 2. Read the fetched content and draft metadata — this is the part you do

For each fetched entry:

1. Read the project's own rule docs — the paths configured in `rules.titleSpec` / `rules.descriptionSpec` / `rules.keywordsSpec` — and follow them exactly. They define the per-content-type templates, character caps, compliance rules, and (if applicable) any category/product alignment tagging (`rules.referenceData`).
2. If required source material is missing or unreachable — **fail closed**: don't guess, note it in a `flags` array on that row instead.

Build a JSON array, one object per entry:

```json
[
  {
    "entryId": "<contentful sys.id, from the fetched data>",
    "slug": "example-slug",
    "title": "...",
    "description": "...",
    "keywords": ["term one", "term two"],
    "flags": []
  }
]
```

Save it, e.g. to `seo-metadata-work/generated-metadata.json`.

### 3. Export for review

```
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.json --format both
```

If `--config` is given (or the default config file exists), validates against `rules.titleMaxLength` / `rules.descriptionMaxLength` when set. Writes `seo-metadata-work/metadata-export.json` and/or `.xlsx`.

### 4. (Optional) Apply back to Contentful

Only after a human has reviewed the export. Defaults to a dry run:

```
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write --publish
```

Requires `CONTENTFUL_MANAGEMENT_TOKEN` and `contentful.seoMetadata` in config. Updates the entry in place (draft only, unless `--publish` is also passed). In `linkedEntry` mode it updates the linked SEO entry (never creates a new one — create it in Contentful first if missing); in `inline` mode it updates the fields directly on the main entry.

## Hard rules (do not skip)

- **Fail closed on missing/unreachable source content** — never fabricate a value the rule docs ask for. Flag it.
- Whatever the project's rule docs say about a compliance/safety screen, it always runs last and always wins over any SEO-score heuristic.
- **Never restate the Title verbatim in the Description**, unless the project's own rules say otherwise.
- Treat any character caps in the rule docs as hard limits — draft to fit, don't rely on `export`'s validator to catch it after the fact.
- Category/product alignment tagging (if the project uses it) is additive and optional — don't force a match that isn't genuinely there, and keep the reference data file up to date by hand.

## Files

- `config.example.json` — the config schema, with placeholders. Copy and fill in per project.
- `rules/*.template.md` — generic templates showing the shape a rule doc needs; not usable as-is.
- `examples/payden-and-rygel/` — a fully filled-in worked example (config + rules + reference data + the original source PDFs), for that specific project.

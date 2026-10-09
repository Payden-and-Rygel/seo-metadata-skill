---
name: seo-metadata
description: Generate SEO metadata (Title/Subtitle/Description/Keywords, plus derived Canonical URL and Schema JSON-LD) for Contentful entries per a project-specific config and rule set, and export the result to JSON/Excel or apply it back to Contentful. Use when asked to fill in missing/generate CMS SEO metadata, audit entries' metadata fields, or export metadata for review. Requires a project config file (see config.example.json) — not usable out of the box against an arbitrary Contentful space until one is set up.
---

# SEO metadata generator (Contentful)

Generates the SEO metadata fields for Contentful entries: Title, Description, Keywords and, if configured, Subtitle are drafted by you. Canonical URL and Schema (JSON-LD) are **derived** by a script from config templates. This skill is **generic**: it has no built-in knowledge of any particular Contentful space's content types, field names, or editorial rules. All of that comes from a config file and a set of rule documents you supply per project.

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
- `contentful.seoMetadata` — how the SEO fields are stored (a linked entry, or inline on the entry itself) and their field names, required for `apply`. Optional `subtitleField`, `canonicalUrlField`, `schemaField`: a field is only written when it's mapped here.

Optional:
- `contentful.fields.richText` — dot-paths of rich-text fields (e.g. `"content.json"`) to flatten into plain text under `_plainText` on fetch; `plainTextMaxChars` caps the length.
- `contentful.locale` — default locale for fetch/apply.
- `canonicalUrl` — `baseUrl`, ordered `rules` (`when` path → `pattern`), `default` pattern, `trailingSlash`. Used by `derive`.
- `schema.template` — a JSON-LD template. `{path}` reads the fetched entry, `{row.x}` the drafted row, `{canonicalUrl}` the derived URL; filters `|date`, `|join`. Empty values are dropped. Used by `derive`.
- `rules.subtitleSpec` / `rules.subtitleMaxLength` — only if the project has a Subtitle field.

`CONTENTFUL_MANAGEMENT_TOKEN` is only needed for the optional `apply --write` step. `CONTENTFUL_PREVIEW_TOKEN` is only needed for `fetch --preview`.

## Workflow

### 1. Fetch entries

```
node bin/seo-metadata-skill.js fetch --slug <slug>
node bin/seo-metadata-skill.js fetch --entry-id <id>
node bin/seo-metadata-skill.js fetch --series <value>       # requires contentful.fields.series in config
node bin/seo-metadata-skill.js fetch --all --only-missing
node bin/seo-metadata-skill.js fetch --hub-slug <slug>       # requires contentful.hubContentType in config
```

Options:
- `--only-missing` — keep only entries missing SEO metadata (works with every mode).
- `--limit <n>` — at most n entries.
- `--preview` — include draft/unpublished content (Content Preview API). Use this when the entries needing metadata aren't published yet.
- `--locale <code>` — fetch a specific locale.
- `--chunk-size <n>` — split output into `fetched-entries.part-001.json`, `part-002`, … Use this for batches bigger than ~20 entries.
- `--keep-rich-text` — keep the raw rich-text JSON next to `_plainText`.

All commands accept `--config <path>` if your config isn't at `./seo-metadata.config.json`.

Writes the entry JSON (whatever fields your config selected) to `seo-metadata-work/fetched-entries.json` (or the part files). Configured rich-text fields are replaced by a plain-text rendering in `_plainText["<path>"]` — read that for the body copy.

### 2. Read the fetched content and draft metadata — this is the part you do

Work one chunk at a time if `fetch` wrote part files: draft `generated-metadata.part-N.json` for `fetched-entries.part-N.json`, then move to the next.

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
    "subtitle": "... (only if rules.subtitleSpec is configured)",
    "flags": []
  }
]
```

Save it, e.g. to `seo-metadata-work/generated-metadata.json`. Do **not** write `canonicalUrl` or `schema` yourself — the next step builds them.

### 3. Derive Canonical URL and Schema

```
node bin/seo-metadata-skill.js derive --input seo-metadata-work/generated-metadata.json --fetched seo-metadata-work/fetched-entries.json
```

Both flags take several files (e.g. all the part files). Fills in `canonicalUrl` and `schema` on each row in place, from the config's `canonicalUrl` / `schema` templates and the fetched entry data. Rows that already have a value keep it unless `--force` is passed. A row whose URL can't be built (missing slug, no matching rule, no fetched entry) gets a `derive:` entry in `flags` instead of a guessed value — report those to the user.

Skip this step if the config has neither `canonicalUrl` nor `schema`.

### 4. Export for review

```
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.json --format both
```

`--input` accepts several files. If `--config` is given (or the default config file exists), validates against `rules.titleMaxLength` / `rules.descriptionMaxLength` / `rules.subtitleMaxLength` when set, and checks that `canonicalUrl` is absolute and `schema` is an object. Writes `seo-metadata-work/metadata-export.json` and/or `.xlsx`.

### 5. (Optional) Apply back to Contentful

**Never write to Contentful without the user's explicit approval** (see Hard rules). Steps 1–4 are read-only; this is the only step that changes Contentful.

1. Run the dry run and show the user exactly which entries, fields and locale would change:
   ```
   node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json
   ```
2. Ask the user to approve that specific write. Stop and wait — do not proceed without a clear "yes".
3. Only after approval, run the write with `--approved`:
   ```
   node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write --approved
   ```
   Add `--publish` only if the user separately and explicitly approved publishing.

Without `--approved`, `--write`/`--publish` prompts for a typed `yes` in an interactive terminal and refuses outright in a non-interactive shell. The planned changes are always printed before anything is written.

Requires `CONTENTFUL_MANAGEMENT_TOKEN` and `contentful.seoMetadata` in config. Writes every field that is both mapped in `contentful.seoMetadata` and present on the row (`--locale` picks the locale). Updates the entry in place (draft only, unless `--publish` is also passed). In `linkedEntry` mode it updates the linked SEO entry (never creates a new one — create it in Contentful first if missing); in `inline` mode it updates the fields directly on the main entry.

## Hard rules (do not skip)

- **Never change anything in Contentful without the user's explicit approval — strictly.** Never run `apply --write`, `apply --publish`, or any other Contentful Management API write (create/update/publish/unpublish/delete — via this tool, curl, or any other means) unless the user has explicitly approved that specific write in the current conversation. Always run the dry run first, show the user what would change, and ask. Approval covers only that one run (same input, same flags) — a changed input, a new batch, or adding `--publish` needs fresh approval. Only pass `--approved` after receiving that approval. Never infer approval from earlier steps, a reviewed export, or general instructions to "finish the task".
- **Fail closed on missing/unreachable source content** — never fabricate a value the rule docs ask for. Flag it.
- Whatever the project's rule docs say about a compliance/safety screen, it always runs last and always wins over any SEO-score heuristic.
- **Never hand-write a Canonical URL or Schema** — they come from `derive` so they match the site's routing. If `derive` flags a row, surface it; don't patch the value by hand.
- **Never restate the Title verbatim in the Description**, unless the project's own rules say otherwise.
- Treat any character caps in the rule docs as hard limits — draft to fit, don't rely on `export`'s validator to catch it after the fact.
- Category/product alignment tagging (if the project uses it) is additive and optional — don't force a match that isn't genuinely there, and keep the reference data file up to date by hand.

## Files

- `config.example.json` — the config schema, with placeholders. Copy and fill in per project.
- `rules/*.template.md` — generic templates showing the shape a rule doc needs; not usable as-is. `subtitle-spec.template.md` is only needed if the project has a Subtitle field.
- `examples/payden-and-rygel/` — a fully filled-in worked example (config + rules + reference data + the original source PDFs), for that specific project.

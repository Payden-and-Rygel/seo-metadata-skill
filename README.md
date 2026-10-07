# seo-metadata-skill

A Claude Code skill that fills in the SEO metadata for Contentful entries:

| Field | How it's produced |
|---|---|
| Title | Drafted by Claude from your rule doc |
| Subtitle *(optional)* | Drafted by Claude from your rule doc |
| Description | Drafted by Claude from your rule doc |
| Keywords | Drafted by Claude from your rule doc |
| Canonical URL | Built by a script from a URL pattern in your config |
| Schema (JSON-LD) | Built by a script from a template in your config |

Results are exported to JSON/Excel for review, and can then be written back to Contentful.

The skill knows nothing about a particular Contentful space or editorial rulebook out of the box. You describe both in a per-project config. A complete worked example for payden.com is in [`examples/payden-and-rygel/`](examples/payden-and-rygel/).

---

## Contents

1. [How it works](#how-it-works)
2. [Install](#install)
3. [Set up a project](#set-up-a-project)
4. [Using it with Claude (recommended)](#using-it-with-claude-recommended)
5. [Full walkthrough: one article, step by step](#full-walkthrough-one-article-step-by-step)
6. [Common recipes](#common-recipes)
7. [Command reference](#command-reference)
8. [Config reference](#config-reference)
9. [Troubleshooting](#troubleshooting)

---

## How it works

```
 fetch  ──▶  draft  ──▶  derive  ──▶  export  ──▶  (human review)  ──▶  apply
 script      Claude      script       script                            script
```

| Step | Who | What happens | Output (in `seo-metadata-work/`) |
|---|---|---|---|
| **fetch** | script | Reads entries from Contentful. Rich-text bodies are converted to plain text. | `fetched-entries.json` (or `.part-NNN.json` chunks) |
| **draft** | Claude | Reads each entry and writes Title / Description / Keywords (and Subtitle, if configured) following your `rules/*.md`. | `generated-metadata.json` |
| **derive** | script | Adds `canonicalUrl` and `schema` to every row from the config templates. | updates `generated-metadata.json` in place |
| **export** | script | Validates the rows (length caps, URL format) and writes a review file. | `metadata-export.json`, `metadata-export.xlsx` |
| **apply** | script | Writes the reviewed rows to Contentful. It is a dry run unless you pass `--write`. | changes in Contentful (draft unless `--publish`) |

Only the **draft** step involves judgment, and that's the part Claude does. Everything else is a plain, repeatable script.

---

## Install

**Requirements:** Node.js 18+, and access to the Contentful space (API tokens).

As a Claude Code skill:

```bash
npx skills add Payden-and-Rygel/seo-metadata-skill
```

Or clone it and install its dependencies:

```bash
git clone <repo-url> seo-metadata-skill
cd seo-metadata-skill
npm install
npm test          # optional: runs the unit tests
```

---

## Set up a project

### Option A — Payden & Rygel (ready-made config)

```bash
cp examples/payden-and-rygel/config.json ./seo-metadata.config.json
cp -r examples/payden-and-rygel/rules ./rules
cp examples/payden-and-rygel/reference-data.json ./rules/reference-data.json
cp .env.example .env
```

Fill in `.env`:

```dotenv
CONTENTFUL_SPACE_ID=<payden space id>
CONTENTFUL_ACCESS_TOKEN=<delivery API token>        # required: read published content
CONTENTFUL_PREVIEW_TOKEN=<preview API token>        # optional: only for --preview (drafts)
CONTENTFUL_ENVIRONMENT_ID=marketing-v2              # payden.com does NOT use "master"
CONTENTFUL_LOCALE=en-US
CONTENTFUL_MANAGEMENT_TOKEN=<CMA token>             # optional: only for apply --write
```

Check the setup with a single entry:

```bash
node bin/seo-metadata-skill.js fetch --slug pov-2025-vol-02-drone-delivery
# Fetched 1 entry -> seo-metadata-work/fetched-entries.json
```

### Option B — a new project

```bash
cp .env.example .env                                  # fill in your Contentful credentials
cp config.example.json ./seo-metadata.config.json      # describe your content type + fields
mkdir -p rules
cp rules/title-spec.template.md        rules/title-spec.md
cp rules/description-spec.template.md  rules/description-spec.md
cp rules/keywords-spec.template.md     rules/keywords-spec.md
cp rules/subtitle-spec.template.md     rules/subtitle-spec.md   # only if you have a Subtitle field
```

Then:

1. **Edit `seo-metadata.config.json`.** At minimum, set the following (see the [Config reference](#config-reference)):
   - `contentful.contentType`
   - `contentful.fields.select`
   - `contentful.seoMetadata`
   - `canonicalUrl`
   - `schema`
2. **Replace every `<...>` placeholder in `rules/*.md`** with your real editorial rules. These are what Claude follows when drafting, so be specific about templates, character limits, and compliance rules.
3. **Check the setup** with `fetch --slug <some-slug>`.

### Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `CONTENTFUL_SPACE_ID` | everything | |
| `CONTENTFUL_ACCESS_TOKEN` | `fetch` | Content Delivery API (published content) |
| `CONTENTFUL_PREVIEW_TOKEN` | `fetch --preview` | Content Preview API (drafts) |
| `CONTENTFUL_ENVIRONMENT_ID` | everything | defaults to `master` |
| `CONTENTFUL_LOCALE` | fetch / apply | overridden by `--locale` or `contentful.locale` in config |
| `CONTENTFUL_MANAGEMENT_TOKEN` | `apply` | Content Management API, write access |
| `SEO_METADATA_CONFIG` | all | alternative to `--config <path>` |

---

## Using it with Claude (recommended)

Once the skill is installed and the project is set up, ask Claude in plain language. Claude runs the scripts, reads the content, drafts the metadata against your rules, and hands you a spreadsheet to review.

**Example prompts:**

> Generate SEO metadata for the article `pov-2025-vol-02-drone-delivery`.

> Fill in missing SEO metadata for all Point of View articles, including drafts, and give me the Excel file to review.

> Audit the latest 10 articles and regenerate their canonical URLs and schema. Keep the existing titles and descriptions.

> The reviewed file is `seo-metadata-work/generated-metadata.json`. Do a dry run of applying it to Contentful.

**A typical session:**

```
You:    Fill in missing SEO metadata for all Point of View articles, including drafts.

Claude: (runs) fetch --series "Point of View" --only-missing --preview --chunk-size 10
        Fetched 23 entries -> 3 chunk files.
        (reads chunk 1, applies rules/title-spec.md, description-spec.md, keywords-spec.md,
         writes generated-metadata.part-1.json, then chunks 2 and 3)
        (runs) derive --input generated-metadata.part-*.json --fetched fetched-entries.part-*.json
        (runs) export --input generated-metadata.part-*.json
        Done: seo-metadata-work/metadata-export.xlsx (23 rows).
        2 rows are flagged for review:
          - pov-2025-vol-04-…: volume number not stated on the page (title left for manual entry)
          - pov-2025-vol-04-…: on-page summary could not be verified

You:    (review the spreadsheet, fix anything, then:) Apply it — dry run first.

Claude: (runs) apply --input generated-metadata.part-*.json
        [dry run] would update linked "seoMetadata" entry 5Xk… for "pov-2025-vol-04-…" (en-US):
                  title, description, keywords, canonicalUrl, richResultSchema
        ...
        Dry run only — no changes were made. Re-run with --write to apply.
```

Claude never writes to Contentful unless you ask, and it always does a dry run first. Rows it can't fill confidently are **flagged, not guessed**. Look at the `flags` column in the spreadsheet.

---

## Full walkthrough: one article, step by step

This is the same flow run by hand, using the Payden config and a real Point of View article. Every command can also be run by Claude for you.

### Step 1 — Fetch

```bash
node bin/seo-metadata-skill.js fetch --slug pov-2025-vol-02-drone-delivery
```

```
Fetched 1 entry -> seo-metadata-work/fetched-entries.json
Next: read this file and draft metadata per your configured rules (...), then run `derive` and `export`.
```

`seo-metadata-work/fetched-entries.json` (trimmed). This article already has metadata, so the walkthrough regenerates it. An entry picked up by `--only-missing` would have empty `seoMetadata` values. The rich-text body is now plain text under `_plainText`:

```json
[
  {
    "sys": { "id": "ZTvv358O8kh1cpHFkRIuQ" },
    "title": "Drone Delivery: Bringing The City To The Suburbs",
    "slug": "pov-2025-vol-02-drone-delivery",
    "publishedDate": "2025-11-03T00:00:00.000Z",
    "series": "Point of View",
    "hero": { "heading": "Drone Delivery:", "image": { "url": "https://images.ctfassets.net/..." } },
    "linkedFrom": { "pointOfViewPageCollection": { "items": [{ "slug": "pov-2025-vol-02" }] } },
    "seoMetadata": {
      "sys": { "id": "..." },
      "title": "Drone Delivery, Point of View Vol. 2 2025 | Payden & Rygel",
      "description": "Drone delivery-on-demand could bring urban-style convenience ...",
      "keywords": ["drone delivery", "Manna Air Delivery", "suburban logistics", "..."],
      "canonicalUrl": "https://www.payden.com/insights/point-of-view/pov-2025-vol-02/pov-2025-vol-02-drone-delivery"
    },
    "_plainText": {
      "content.json": "Is it a bird? A plane? Or...Superman?\nNope. It turns out it's just piping-hot coffee being delivered by a drone.\n..."
    }
  }
]
```

### Step 2 — Draft (Claude)

Claude reads the entry and follows `rules/title-spec.md`, `rules/description-spec.md` and `rules/keywords-spec.md`. For a Point of View article, those rules give:
- **Title:** `{Leading Title}, Point of View Vol. {N} {Year} | Payden & Rygel`
- **Description:** at most 130 characters, built from the on-page summary if one exists.
- **Keywords:** about 10 content terms, plus strategy/fund tags.

The output is `seo-metadata-work/generated-metadata.json`. The values below are illustrative:

```json
[
  {
    "entryId": "ZTvv358O8kh1cpHFkRIuQ",
    "slug": "pov-2025-vol-02-drone-delivery",
    "title": "Drone Delivery, Point of View Vol. 2 2025 | Payden & Rygel",
    "description": "How drone delivery moved from science fiction to suburban reality, and what it could mean for logistics, retail and regulators.",
    "keywords": ["drone delivery", "logistics", "last-mile delivery", "FAA", "retail", "autonomous vehicles", "Point of View"],
    "flags": []
  }
]
```

> Claude does **not** write `canonicalUrl` or `schema`. The next step builds them.
> If something the rules require is missing (e.g. no volume number on the page), Claude leaves the value out and adds a note to `flags` instead of guessing.

### Step 3 — Derive the Canonical URL and Schema

```bash
node bin/seo-metadata-skill.js derive \
  --input   seo-metadata-work/generated-metadata.json \
  --fetched seo-metadata-work/fetched-entries.json
```

```
Derived 2 field(s) -> seo-metadata-work/generated-metadata.json
```

The row now also has:

```json
{
  "canonicalUrl": "https://www.payden.com/insights/point-of-view/pov-2025-vol-02/pov-2025-vol-02-drone-delivery",
  "schema": {
    "@context": "https://schema.org",
    "@type": "Article",
    "description": "How drone delivery moved from science fiction to suburban reality, ...",
    "keywords": ["drone delivery", "logistics", "last-mile delivery", "FAA", "retail", "autonomous vehicles", "Point of View"],
    "datePublished": "2025-11-03",
    "mainEntityOfPage": "https://www.payden.com/insights/point-of-view/pov-2025-vol-02/pov-2025-vol-02-drone-delivery",
    "author": [{ "url": "https://www.payden.com/", "name": "Payden & Rygel", "@type": "Organization" }],
    "publisher": { "url": "https://www.payden.com/", "name": "Payden & Rygel", "@type": "Organization" }
  }
}
```

The URL matched the Point of View rule because the article is linked from the `pov-2025-vol-02` hub. An ordinary article, such as `em-monthly-commentary-2026-09`, falls through to the default pattern: `https://www.payden.com/insights/em-monthly-commentary-2026-09`.

### Step 4 — Export for review

```bash
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.json
```

```
Exported 1 row(s) -> seo-metadata-work/metadata-export.json, seo-metadata-work/metadata-export.xlsx
```

The spreadsheet has these columns:

```
entryId | slug | series | title | titleLength | subtitle | subtitleLength | description | descriptionLength | keywords | canonicalUrl | schema | flags
```

Export **fails** with a clear message in these cases:
- A title, description, or subtitle is over the cap set in config (`rules.*MaxLength`).
- A canonical URL isn't absolute.
- The same `entryId` appears twice.

Send the `.xlsx` to whoever signs off on SEO copy. If they request changes, make them in `generated-metadata.json` (or ask Claude to) and export again.

### Step 5 — Apply to Contentful

Always start with a dry run (the default):

```bash
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json
```

```
[dry run] would update linked "seoMetadata" entry 3hF… for "pov-2025-vol-02-drone-delivery" (en-US): title, description, keywords, canonicalUrl, richResultSchema

Dry run only — no changes were made. Re-run with --write to apply.
```

Then write the changes. They are saved as drafts, so nothing goes live yet:

```bash
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write
```

Check the entries in the Contentful web app. Publish them there, or re-run with `--publish`:

```bash
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write --publish
```

> Try `--write` against a sandbox environment first by setting `CONTENTFUL_ENVIRONMENT_ID`.
> In `linkedEntry` mode the SEO entry must already exist. The tool updates it but never creates it.

---

## Common recipes

**Fill every entry that has no metadata, in chunks of 20:**

```bash
node bin/seo-metadata-skill.js fetch --all --only-missing --chunk-size 20
# -> fetched-entries.part-001.json, part-002.json, ...
# Claude drafts generated-metadata.part-1.json, part-2.json, ... one chunk at a time
node bin/seo-metadata-skill.js derive --input seo-metadata-work/generated-metadata.part-*.json \
                                      --fetched seo-metadata-work/fetched-entries.part-*.json
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.part-*.json
```

**Include unpublished drafts** (needs `CONTENTFUL_PREVIEW_TOKEN`):

```bash
node bin/seo-metadata-skill.js fetch --series "Week in Review" --only-missing --preview
```

**Just try it on a few entries first:**

```bash
node bin/seo-metadata-skill.js fetch --all --only-missing --limit 3
```

**Fix wrong canonical URLs on existing metadata** without re-drafting titles or descriptions. Put the current values in the rows, then force-recompute the derived fields:

```bash
node bin/seo-metadata-skill.js derive --input rows.json --fetched seo-metadata-work/fetched-entries.json --force
```

**A Point of View hub page** (uses `hubContentType` / `hubFields` from config):

```bash
node bin/seo-metadata-skill.js fetch --hub-slug pov-2025-vol-02
```

**Another locale:**

```bash
node bin/seo-metadata-skill.js fetch --slug some-slug --locale fr-FR
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --locale fr-FR
```

**A config stored somewhere else:**

```bash
node bin/seo-metadata-skill.js fetch --slug some-slug --config path/to/seo-metadata.config.json
```

---

## Command reference

All commands accept `--config <path>` (default `./seo-metadata.config.json`). Output goes to `./seo-metadata-work/` unless you pass `--out <dir>`.

### `fetch`

Pick exactly one mode:

| Mode | Description |
|---|---|
| `--slug <slug>` | One entry, looked up by slug |
| `--entry-id <id>` | One entry, looked up by Contentful ID |
| `--series <value>` | All entries whose `fields.series` equals the value |
| `--all` | All entries of the content type |
| `--hub-slug <slug>` | One hub/landing entry |

Options:

| Option | Description |
|---|---|
| `--only-missing` | Keep only entries whose SEO fields are empty (works with any mode) |
| `--limit <n>` | Return at most n entries |
| `--preview` | Include drafts (Content Preview API) |
| `--locale <code>` | Locale to read |
| `--chunk-size <n>` | Split the output into `*.part-NNN.json` files |
| `--keep-rich-text` | Keep the raw rich-text JSON next to `_plainText` |
| `--out-file <name>` | Output filename (default `fetched-entries.json`) |

### `derive`

| Option | Description |
|---|---|
| `--input <files...>` | Drafted rows to update in place (required) |
| `--fetched <files...>` | The fetched-entry files those rows came from (required) |
| `--force` | Recompute even if a row already has `canonicalUrl` / `schema` |
| `--out-file <name>` | Write all rows to one new file instead of updating the inputs |

### `export`

| Option | Description |
|---|---|
| `--input <files...>` | Rows to export (required) |
| `--format json\|xlsx\|both` | Output format (default `both`) |
| `--out-file <name>` | Filename without extension (default `metadata-export`) |

### `apply`

| Option | Description |
|---|---|
| `--input <files...>` | Rows to apply; each row must have `entryId` (required) |
| `--write` | Actually write the changes (without it, this is a dry run) |
| `--publish` | Also publish the updated entry (implies `--write`) |
| `--locale <code>` | Locale to write (default `en-US`) |

### Row format (`generated-metadata.json`)

```json
{
  "entryId": "required for apply/derive — the Contentful sys.id",
  "slug": "required",
  "title": "required",
  "description": "required",
  "keywords": ["required", "array or comma-separated string"],
  "subtitle": "optional",
  "canonicalUrl": "added by derive",
  "schema": { "added": "by derive" },
  "flags": ["optional notes for the reviewer"]
}
```

---

## Config reference

`seo-metadata.config.json`, annotated (the comments are for explanation only — JSON doesn't allow them):

```jsonc
{
  "contentful": {
    "contentType": "Article",              // Contentful content type ID
    "locale": null,                        // optional default locale
    "fields": {
      "slug": "slug",                      // field used by --slug
      "series": "series",                  // field used by --series (or null)
      "select": [                          // GraphQL selections to fetch
        "title", "slug", "publishedDate", "content { json }",
        "seoMetadata { sys { id } title description keywords canonicalUrl richResultSchema }",
        "linkedFrom { pointOfViewPageCollection(limit: 1) { items { slug } } }"
      ],
      "richText": ["content.json"],        // rich-text paths converted to plain text
      "plainTextMaxChars": 12000           // optional cap on that plain text
    },
    "seoMetadata": {
      "mode": "linkedEntry",               // "linkedEntry" (separate SEO entry) or "inline"
      "field": "seoMetadata",              // field holding the link / inline object
      "titleField": "title",
      "descriptionField": "description",
      "keywordsField": "keywords",
      "subtitleField": null,               // set only if the field exists
      "canonicalUrlField": "canonicalUrl", // omit to never write it
      "schemaField": "richResultSchema",   // omit to never write it
      "missingCheckFields": ["title", "description"]   // what --only-missing checks
    }
  },

  "canonicalUrl": {
    "baseUrl": "https://www.payden.com",
    "rules": [                             // first rule whose `when` path has a value wins
      { "when": "linkedFrom.pointOfViewPageCollection.items.0.slug",
        "pattern": "/insights/point-of-view/{linkedFrom.pointOfViewPageCollection.items.0.slug}/{slug}" }
    ],
    "default": "/insights/{slug}",
    "trailingSlash": false
  },

  "schema": {
    "template": {
      "@context": "https://schema.org",
      "@type": "Article",
      "description": "{row.description}",       // {row.x}        = drafted value
      "keywords": "{row.keywords}",             // single token   = keeps arrays as arrays
      "datePublished": "{publishedDate|date}",  // {path|date}    = YYYY-MM-DD
      "mainEntityOfPage": "{canonicalUrl}"      // {canonicalUrl} = derived URL
    }
  },

  "rules": {
    "titleSpec": "./rules/title-spec.md",
    "descriptionSpec": "./rules/description-spec.md",
    "keywordsSpec": "./rules/keywords-spec.md",
    "subtitleSpec": null,
    "referenceData": "./rules/reference-data.json",
    "titleMaxLength": 256,
    "descriptionMaxLength": 130,
    "subtitleMaxLength": null
  }
}
```

**Template tokens** (used in `canonicalUrl` patterns and in `schema.template`):

| Token | Resolves to |
|---|---|
| `{slug}`, `{hero.heading}`, `{items.0.slug}` | A value from the fetched entry, by dot path (numbers index into arrays) |
| `{row.description}` | A value from the drafted row |
| `{canonicalUrl}` | The derived canonical URL (schema only) |
| `{x\|date}` / `{x\|join}` | Formats as `YYYY-MM-DD` / joins an array with `", "` |

Schema values that resolve to nothing are **dropped**, so the output never contains empty strings. A canonical URL with a missing token is **not written**, and the row gets a `derive:` flag instead.

Remove the `canonicalUrl` or `schema` block to turn that field off entirely.

---

## Troubleshooting

| Message | Fix |
|---|---|
| `Config file not found` | Copy a config to `./seo-metadata.config.json`, or pass `--config`. |
| `Missing required env var CONTENTFUL_…` | Fill in `.env`. `--preview` needs `CONTENTFUL_PREVIEW_TOKEN`; `apply` needs `CONTENTFUL_MANAGEMENT_TOKEN`. |
| `Cannot query field "…Collection"` | `contentful.contentType` is wrong. Use the content type **ID** from Contentful. |
| `Cannot query field "x" on type "Article"` | A field in `fields.select` doesn't exist on that content type. |
| `No matching entries found.` | Wrong slug or environment (Payden uses `marketing-v2`), or the entry is a draft: add `--preview`. |
| `has no linked "seoMetadata" entry yet` | Create the SEO metadata entry in Contentful first. `apply` only updates existing entries. |
| `title exceeds N chars` | The draft is over the cap. Shorten it (or ask Claude to), then export again. |
| `derive: canonical URL pattern … has empty token(s): slug` | The entry is missing a field the URL needs. Fill it in Contentful, or set the URL by hand after review. |
| `Duplicate entryId` | The same entry appears in two input files. Remove one. |

---

## Repository layout

```
bin/seo-metadata-skill.js     CLI entry point
scripts/                      fetch / derive / export / apply
lib/                          Contentful client, query builders, rich-text + derive helpers
rules/*.template.md           blank rule-doc templates
config.example.json           blank config
examples/payden-and-rygel/    complete worked example (config, rules, reference data, source PDFs)
test/                         unit tests (npm test)
SKILL.md                      instructions Claude follows when the skill runs
```

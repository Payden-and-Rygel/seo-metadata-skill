# seo-metadata-skill

A Claude skill (Claude Code and Cowork) that fills in the SEO metadata for Contentful entries:

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

**Requirements:** Node.js 18+, and access to the Contentful space (API tokens). That's all: there is **no `npm install` step**. The two dependencies (commander, SheetJS xlsx) are bundled in `vendor/`.

Don't have Node? Install the LTS release from [nodejs.org](https://nodejs.org), or `brew install node` (macOS), or `winget install OpenJS.NodeJS.LTS` (Windows). Check with `node --version`.

The ready-to-install skill is committed to this repo as [`dist/seo-metadata.zip`](dist/seo-metadata.zip), about 200 KB. The repo is private, so you need read access to `Payden-and-Rygel/seo-metadata-skill`.

### Cowork (Claude desktop)

1. Download the zip from GitHub: open [`dist/seo-metadata.zip`](dist/seo-metadata.zip) and click **Download raw file**, or use https://github.com/Payden-and-Rygel/seo-metadata-skill/raw/main/dist/seo-metadata.zip while signed in.
2. In Claude desktop, go to **Customize → Add → Upload a skill** and choose the zip. **Upload plugin** works too, since the zip includes `.claude-plugin/plugin.json`.
3. Make sure code execution is on, and allow Claude's sandbox to reach Contentful. Add `graphql.contentful.com` (fetch) and `api.contentful.com` (apply) to the network egress allowlist under Settings → Capabilities, or ask your org admin.
4. In a Cowork task, select the folder that holds (or will hold) your `seo-metadata.config.json` and `rules/`, and ask Claude to generate SEO metadata. Exports appear in `seo-metadata-work/` in that folder.

To update, download the zip again and re-upload it, replacing the old skill.

#### Prompt to paste in Cowork

After uploading the skill, start a new Cowork task, select your project folder, and paste this prompt:

```text
Use the seo-metadata skill. This is a Cowork session, so:
- Run the skill's scripts from this selected folder, and do not run npm install. Node.js 18+ is the only requirement, so check `node --version` first.
- Save my Contentful credentials with `setup --local` so they're kept in this folder for future sessions. Ask me for any that are missing, and never repeat token values back to me.
- If there's no seo-metadata.config.json here, ask me whether to use the Payden & Rygel example config from the skill or start from the blank template, and copy the matching rules/ and reference-data.json into this folder.
- If Contentful can't be reached (fetch failed / ENOTFOUND), tell me to allow graphql.contentful.com and api.contentful.com in network egress settings.
Then check setup and ask me what I'd like to do.
```

You only need the full prompt the first time in a folder. After that, a short request is enough. For example:

```text
Use the seo-metadata skill to generate SEO metadata for the article with slug <slug> and export it to Excel.
```

```text
Use the seo-metadata skill to find all articles missing SEO metadata, draft it for up to 10, and export for review.
```

Nothing is written to Contentful unless you explicitly approve it after a dry run.

### Claude Code

```bash
npx skills add Payden-and-Rygel/seo-metadata-skill
```

Or unzip `dist/seo-metadata.zip` into `~/.claude/skills/`, which gives you `~/.claude/skills/seo-metadata/SKILL.md`.

To work on the skill itself, clone the repo. There's no install step, and `npm test` runs the unit tests. The `node scripts/cli.js …` commands below assume you're running from a clone. Add `--config <path>` or run from your project folder as needed.

### Updating the zip (maintainers)

The zip is built from the source files, so rebuild it whenever you change the skill, and commit it along with the change:

```bash
npm run package     # rewrites dist/seo-metadata.zip
npm test            # fails if the committed zip is out of date with the source
```

The zip only contains the generic skill files, never a project's own config, rules or credentials.

Credentials in Cowork are saved in that folder, in `.seo-metadata/credentials.json` (see [Credentials](#credentials)), because the sandbox doesn't keep your home folder between sessions.

---

## Set up a project

> **Easiest:** just start using the skill in Claude Code or Cowork. On the first run Claude checks the saved credentials. If the space ID or access token is missing, Claude asks you for them and saves them once for you. Later runs, in any project, reuse them. No `.env` file is used.

### Option A — Payden & Rygel (ready-made config)

```bash
cp examples/payden-and-rygel/config.json ./seo-metadata.config.json
cp -r examples/payden-and-rygel/rules ./rules
cp examples/payden-and-rygel/reference-data.json ./rules/reference-data.json
```

Save your Contentful credentials once (see [Credentials](#credentials)):

```bash
node scripts/cli.js setup --environment-id marketing-v2   # payden.com does NOT use "master"
node scripts/cli.js setup        # asks for the space ID and access token
```

Check the setup with a single entry:

```bash
node scripts/cli.js fetch --slug pov-2025-vol-02-drone-delivery
# Fetched 1 entry -> seo-metadata-work/fetched-entries.json
```

### Option B — a new project

```bash
cp config.example.json ./seo-metadata.config.json      # describe your content type + fields
mkdir -p rules
cp rules/title-spec.template.md        rules/title-spec.md
cp rules/description-spec.template.md  rules/description-spec.md
cp rules/keywords-spec.template.md     rules/keywords-spec.md
cp rules/subtitle-spec.template.md     rules/subtitle-spec.md   # only if you have a Subtitle field
```

Then:

1. **Save your Contentful credentials** with `node scripts/cli.js setup` (see [Credentials](#credentials)).
2. **Edit `seo-metadata.config.json`.** At minimum, set the following (see the [Config reference](#config-reference)):
   - `contentful.contentType`
   - `contentful.fields.select`
   - `contentful.seoMetadata`
   - `canonicalUrl`
   - `schema`
3. **Replace every `<...>` placeholder in `rules/*.md`** with your real editorial rules. These are what Claude follows when drafting, so be specific about templates, character limits, and compliance rules.
4. **Check the setup** with `fetch --slug <some-slug>`.

### Credentials

Credentials are saved **once per user**, outside every project, in `~/.config/seo-metadata-skill/credentials.json` (file mode 600). Nothing is read from a `.env` file.

In **Cowork**, use `setup --local` instead: it saves to `.seo-metadata/credentials.json` in the current folder (file mode 600, with a `.gitignore` so it's never committed). Whenever that file exists in the folder you run from, it's used instead of the per-user file.

```bash
node scripts/cli.js setup                       # show what's saved (tokens masked); in a terminal, asks for anything missing
node scripts/cli.js setup --space-id <id> --access-token <token>
node scripts/cli.js setup --management-token <token>   # only when you need apply --write
node scripts/cli.js setup --local --space-id <id> --access-token <token>   # Cowork: save in ./.seo-metadata/
node scripts/cli.js setup --clear               # delete the credentials file in use
```

If a command needs a value that isn't saved, it asks you for it in an interactive terminal (tokens aren't echoed) and saves it. In a non-interactive shell it fails with the exact `setup` flag to use. Claude handles that by asking you in chat.

| `setup` flag | Needed for | Notes |
|---|---|---|
| `--space-id` | everything | |
| `--access-token` | `fetch` | Content Delivery API (published content) |
| `--preview-token` | `fetch --preview` | Content Preview API (drafts) |
| `--environment-id` | everything | defaults to `master` |
| `--locale` | fetch / apply | overridden by `--locale` or `contentful.locale` in config |
| `--management-token` | `apply --write` | Content Management API, write access |

Environment variables with the matching name (`CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_PREVIEW_TOKEN`, `CONTENTFUL_ENVIRONMENT_ID`, `CONTENTFUL_LOCALE`, `CONTENTFUL_MANAGEMENT_TOKEN`) override the saved values, for example in CI. `SEO_METADATA_CREDENTIALS` changes where credentials are stored. `SEO_METADATA_CONFIG` is an alternative to `--config <path>`.

---

## Using it with Claude (recommended)

Once the skill is installed and the project is set up, ask Claude in plain language. Claude runs the scripts, reads the content, drafts the metadata against your rules, and hands you a spreadsheet to review.

If you just invoke the skill without saying what you want, Claude asks you in a short menu:

1. **What would you like to do?** Generate SEO metadata · Re-export existing drafts · Apply reviewed metadata to Contentful · Check / update setup
2. **Which entries?** (for Generate) Single entry · Multiple entries (a list of slugs or IDs) · All entries missing metadata · A series or hub page (only shown if your config has one)
3. **Run options:** include unpublished drafts? Excel, JSON, or both?

Then Claude asks only for what that choice needs, such as the slug or the list of slugs.

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
        Dry run only — no changes were made. Re-run with --write to apply (requires user approval).
```

Claude **never** writes to Contentful without your explicit approval: it always does a dry run first, shows you what would change, and waits for a clear yes for that specific run (publishing needs its own yes). Rows it can't fill confidently are **flagged, not guessed**. Look at the `flags` column in the spreadsheet.

---

## Full walkthrough: one article, step by step

This is the same flow run by hand, using the Payden config and a real Point of View article. Every command can also be run by Claude for you.

### Step 1 — Fetch

```bash
node scripts/cli.js fetch --slug pov-2025-vol-02-drone-delivery
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
node scripts/cli.js derive \
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
node scripts/cli.js export --input seo-metadata-work/generated-metadata.json
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
node scripts/cli.js apply --input seo-metadata-work/generated-metadata.json
```

```
[dry run] would update linked "seoMetadata" entry 3hF… for "pov-2025-vol-02-drone-delivery" (en-US): title, description, keywords, canonicalUrl, richResultSchema

Dry run only — no changes were made. Re-run with --write to apply (requires user approval).
```

Then write the changes. They are saved as drafts, so nothing goes live yet. The planned changes are printed again, and you must type `yes` to continue:

```bash
node scripts/cli.js apply --input seo-metadata-work/generated-metadata.json --write
```

In a non-interactive shell (e.g. when Claude runs it) `--write` is refused unless `--approved` is also passed. Claude only adds `--approved` after you have explicitly approved that write.

Check the entries in the Contentful web app. Publish them there, or re-run with `--publish`:

```bash
node scripts/cli.js apply --input seo-metadata-work/generated-metadata.json --write --publish
```

> Try `--write` against a sandbox environment first: `setup --environment-id <sandbox>`.
> In `linkedEntry` mode, a page with no SEO entry makes `apply` fail, unless you pass `--create-missing`. With that flag it creates a new SEO entry (using `createDefaults` from the config for fields such as `enableSearchEngineIndexing`) and links it to the page. Both stay as drafts unless you also pass `--publish`.

---

## Common recipes

**Several specific entries:**

```bash
node scripts/cli.js fetch --slug first-slug second-slug third-slug
```

**Fill every entry that has no metadata, in chunks of 20:**

```bash
node scripts/cli.js fetch --all --only-missing --chunk-size 20
# -> fetched-entries.part-001.json, part-002.json, ...
# Claude drafts generated-metadata.part-1.json, part-2.json, ... one chunk at a time
node scripts/cli.js derive --input seo-metadata-work/generated-metadata.part-*.json \
                                      --fetched seo-metadata-work/fetched-entries.part-*.json
node scripts/cli.js export --input seo-metadata-work/generated-metadata.part-*.json
```

**Include unpublished drafts** (needs a preview token, `setup --preview-token`):

```bash
node scripts/cli.js fetch --series "Week in Review" --only-missing --preview
```

**Just try it on a few entries first:**

```bash
node scripts/cli.js fetch --all --only-missing --limit 3
```

**Fix wrong canonical URLs on existing metadata** without re-drafting titles or descriptions. Put the current values in the rows, then force-recompute the derived fields:

```bash
node scripts/cli.js derive --input rows.json --fetched seo-metadata-work/fetched-entries.json --force
```

**A Point of View hub page** (uses `hubContentType` / `hubFields` from config):

```bash
node scripts/cli.js fetch --hub-slug pov-2025-vol-02
```

**Another locale:**

```bash
node scripts/cli.js fetch --slug some-slug --locale fr-FR
node scripts/cli.js apply --input seo-metadata-work/generated-metadata.json --locale fr-FR
```

**A config stored somewhere else:**

```bash
node scripts/cli.js fetch --slug some-slug --config path/to/seo-metadata.config.json
```

---

## Command reference

All commands accept `--config <path>` (default `./seo-metadata.config.json`). Output goes to `./seo-metadata-work/` unless you pass `--out <dir>`.

### `fetch`

Pick exactly one mode:

| Mode | Description |
|---|---|
| `--slug <slugs...>` | One or more entries, looked up by slug (space- or comma-separated). Slugs that don't match are reported and skipped |
| `--entry-id <ids...>` | One or more entries, looked up by Contentful ID (space- or comma-separated) |
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
| `--create-missing` | In `linkedEntry` mode, when an entry has no linked SEO entry, create one (with `createDefaults` + the row's fields) and link it to the page. Without this flag, such rows fail. |
| `--publish` | Also publish the updated entry (implies `--write`). With `--create-missing`, the new SEO entry is published and the page is republished only if it had no other unpublished edits. |
| `--approved` | Skip the interactive `yes` prompt; required for `--write`/`--publish` in non-interactive shells. Pass only after the user approved this write. |
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
      "missingCheckFields": ["title", "description"],  // what --only-missing checks
      "createDefaults": {                  // only for apply --create-missing: extra fields on new SEO entries
        "enableSearchEngineIndexing": true,
        "priority": "1.0"
      },
      "contentType": null                  // SEO entry content type ID; null = what the link field accepts
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
| `node: command not found`, or `Node.js 18 or newer is required` | Install Node.js LTS (see [Install](#install)), restart the terminal or app, and check `node --version`. |
| `npm ERR!` / errors downloading `xlsx` from `cdn.sheetjs.com` | Not needed any more: there's no `npm install` step. Pull the latest version, delete any old `node_modules/`, and run the commands directly. |
| `Cannot find module '../vendor/…'` | The skill copy is incomplete. Reinstall the plugin, or re-clone. |
| `fetch failed` / `ENOTFOUND graphql.contentful.com` in Cowork | The sandbox can't reach Contentful. Allow `graphql.contentful.com` and `api.contentful.com` in network egress settings. |
| Cowork asks for tokens every session | Save them with `setup --local` so they're kept in the selected folder. |
| `Config file not found` | Copy a config to `./seo-metadata.config.json`, or pass `--config`. |
| `Missing Contentful …` | Run the `setup` command shown in the error, or run `setup` in a terminal and it asks for the value. `--preview` needs a preview token; `apply --write` needs a management token. |
| `Cannot query field "…Collection"` | `contentful.contentType` is wrong. Use the content type **ID** from Contentful. |
| `Cannot query field "x" on type "Article"` | A field in `fields.select` doesn't exist on that content type. |
| `No matching entries found.` | Wrong slug or environment (Payden uses `marketing-v2`), or the entry is a draft: add `--preview`. |
| `has no linked "seoMetadata" entry yet` | Re-run `apply` with `--create-missing` to create and link one (dry run first). |
| `Created "seoMetadata" entry … but failed to link it` | The SEO entry exists but isn't linked, often because someone edited the page at the same moment. Link it by hand in Contentful, or delete it and re-run. |
| `title exceeds N chars` | The draft is over the cap. Shorten it (or ask Claude to), then export again. |
| `derive: canonical URL pattern … has empty token(s): slug` | The entry is missing a field the URL needs. Fill it in Contentful, or set the URL by hand after review. |
| `Duplicate entryId` | The same entry appears in two input files. Remove one. |

---

## Repository layout

```
scripts/cli.js     CLI entry point
.claude-plugin/plugin.json     plugin manifest (lets the zip be used with "Upload plugin")
dist/seo-metadata.zip         installable skill zip, rebuilt with npm run package
scripts/cli.js                CLI entry point
scripts/                      fetch / derive / export / apply, plus package-skill.js (builds the fallback zip)
lib/                          Contentful client, query builders, rich-text + derive helpers
vendor/                       bundled dependencies (commander, SheetJS xlsx) — no npm install needed
rules/*.template.md           blank rule-doc templates
config.example.json           blank config
examples/payden-and-rygel/    complete worked example (config, rules, reference data, source PDFs)
test/                         unit tests (npm test)
SKILL.md                      instructions Claude follows when the skill runs
```

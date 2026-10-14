---
name: seo-metadata
description: Generate SEO metadata (Title/Subtitle/Description/Keywords, plus derived Canonical URL and Schema JSON-LD) for Contentful entries per a project-specific config and rule set, and export the result to JSON/Excel or apply it back to Contentful. Use when asked to fill in missing/generate CMS SEO metadata, audit entries' metadata fields, or export metadata for review. Requires a project config file (see config.example.json) — not usable out of the box against an arbitrary Contentful space until one is set up.
---

# SEO metadata generator (Contentful)

Generates the SEO metadata fields for Contentful entries: Title, Description, Keywords and, if configured, Subtitle are drafted by you. Canonical URL and Schema (JSON-LD) are **derived** by a script from config templates. This skill is **generic**: it has no built-in knowledge of any particular Contentful space's content types, field names, or editorial rules. All of that comes from a config file and a set of rule documents you supply per project.

This skill's scripts do the mechanical *fetching* and *exporting*. **You (Claude) do the actual drafting** by reading the fetched content and applying the project's rule docs — this is judgment work, not a template fill-in a script could do reliably.

## Running the scripts (Claude Code and Cowork)

This skill works the same in Claude Code and in Cowork (Claude desktop).

- `${CLAUDE_SKILL_DIR}` in the commands below is this skill's own directory and is normally filled in automatically. If it still appears literally, replace it with the skill's base directory (shown when the skill loaded). Keep the path quoted.
- Run every command from the **user's working folder**, not from the skill directory: the project folder in Claude Code, or the folder the user selected in Cowork. `seo-metadata.config.json`, `rules/` and the output folder `seo-metadata-work/` all live there. In Cowork, the skill directory is read-only.
- **No `npm install` is needed.** The only dependencies are vendored under `${CLAUDE_SKILL_DIR}/vendor/`. Never run `npm install` for this skill; if a command fails with `Cannot find module`, the skill copy is incomplete, so tell the user to reinstall it.
- The only requirement is Node.js 18 or newer (see step 0).

### Running in Cowork

- The skill is installed by uploading `dist/seo-metadata.zip` from the GitHub repo. To update it, the user downloads the latest zip and uploads it again.
- Cowork's sandbox does not keep the home folder between sessions, so save credentials with `setup --local`. They go to `.seo-metadata/credentials.json` in the selected folder (file mode 600, with its own `.gitignore`), and later sessions in the same folder find them automatically.
- Contentful must be reachable from the sandbox. If `fetch` or `apply` fails with `fetch failed`, `ENOTFOUND`, or a network/egress error, tell the user to allow `graphql.contentful.com` (fetch) and `api.contentful.com` (apply) in Claude's network egress settings (Settings → Capabilities, or their org admin), then retry.
- Tell the user that exports are in `seo-metadata-work/` in their selected folder.

## Setup (one-time, per project)

From the working folder:

```
cp "${CLAUDE_SKILL_DIR}/config.example.json" ./seo-metadata.config.json    # describe this project's Contentful schema
mkdir -p rules && cp "${CLAUDE_SKILL_DIR}"/rules/*.template.md ./rules/      # then rename, dropping .template, and fill in
```

Contentful credentials are **not** read from a `.env` file. They're saved once per user by `setup` in `~/.config/seo-metadata-skill/credentials.json` (file mode 600, outside every project) and reused on every run. In Cowork use `setup --local` instead (see above); when `./.seo-metadata/credentials.json` exists in the working folder, it is used instead of the per-user file. You can override the path with `SEO_METADATA_CREDENTIALS`. A real environment variable such as `CONTENTFUL_ACCESS_TOKEN` (e.g. in CI) takes precedence over the stored value.

If a config for this exact project already exists under `${CLAUDE_SKILL_DIR}/examples/` (check there first), copy that instead of starting from the blank template — see `examples/payden-and-rygel/` for what a filled-in example looks like.

`seo-metadata.config.json` must define, at minimum:
- `contentful.contentType` — the Contentful content type ID to query.
- `contentful.fields.slug` — the field used to look up an entry by slug.
- `contentful.fields.select` — the GraphQL field selections to fetch (raw snippets, e.g. `"hero { image { url } }"`).
- `contentful.seoMetadata` — how the SEO fields are stored (a linked entry, or inline on the entry itself) and their field names, required for `apply`. Optional `subtitleField`, `canonicalUrlField`, `schemaField`: a field is only written when it's mapped here. Optional `createDefaults` (extra field values set only on SEO entries created by `apply --create-missing`, e.g. a required indexing flag) and `contentType` (the SEO entry's content type ID; by default, the one the page's link field accepts).

Optional:
- `contentful.fields.richText` — dot-paths of rich-text fields (e.g. `"content.json"`) to flatten into plain text under `_plainText` on fetch; `plainTextMaxChars` caps the length.
- `contentful.locale` — default locale for fetch/apply.
- `canonicalUrl` — `baseUrl`, ordered `rules` (`when` path → `pattern`), `default` pattern, `trailingSlash`. Used by `derive`.
- `schema.template` — a JSON-LD template. `{path}` reads the fetched entry, `{row.x}` the drafted row, `{canonicalUrl}` the derived URL; filters `|date`, `|join`. Empty values are dropped. Used by `derive`.
- `rules.subtitleSpec` / `rules.subtitleMaxLength` — only if the project has a Subtitle field.

The management token is only needed for the optional `apply --write` step. The preview token is only needed for `fetch --preview`.

## Start here (every run)

Make the run interactive: check setup, then ask the user what they want to do with your question picker (multiple-choice; "Other" is always available) rather than assuming. Ask only for the inputs the chosen action needs.

### Step 0 — Credentials and config check

Run this first. If everything is already set, say nothing and go to step 0.5.

1. Run `node --version`. If `node` is not found or the version is below 18, stop and help the user install Node.js LTS. On macOS use the installer from https://nodejs.org or `brew install node`. On Windows use the installer from https://nodejs.org or `winget install OpenJS.NodeJS.LTS`. On Linux use the distro package or nvm. Ask them to restart the terminal or app afterwards, then re-check. Do not run `npm install`; nothing needs installing besides Node.
2. Run `node "${CLAUDE_SKILL_DIR}/scripts/cli.js" setup < /dev/null`. It prints which credentials are stored, with tokens masked, and exits 1 if the space ID or access token is missing. Never read the credentials file directly.
3. If anything required is missing, ask the user for it. Don't continue without it:
   - **Space ID** (Contentful → Settings → General settings)
   - **Content Delivery API access token** (Contentful → Settings → API keys)
   - **Environment ID**, only if it isn't `master`
   - **Preview token** (optional, only needed to generate for unpublished drafts)

   Save what they give you: `node "${CLAUDE_SKILL_DIR}/scripts/cli.js" setup --space-id <id> --access-token <token> [--environment-id <id>] [--preview-token <token>]`. In Cowork, add `--local`. It's saved once, and later runs reuse it without asking (in Claude Code, from any project; in Cowork, from the same folder). Never repeat token values in your replies.

   Alternatively the user can run `node "${CLAUDE_SKILL_DIR}/scripts/cli.js" setup` in their own terminal. It asks for anything missing (tokens aren't echoed), so the token never appears in the chat.
4. Use the same pattern whenever a command fails with `Missing Contentful …`: ask the user for that one value, save it with the `setup` flag the error names, and re-run the command.
5. Don't ask for the management token here. Ask for it only at the apply step, after the user has approved a write, and save it with `setup --management-token <token>`.
6. Check the config: if `seo-metadata.config.json` is missing, ask whether to use a ready-made config from `${CLAUDE_SKILL_DIR}/examples/` (list the folders there; copy its `config.json` to `./seo-metadata.config.json` and its `rules/` and `reference-data.json` alongside) or start from the blank template (see Setup above).
7. Check the credentials with a read-only fetch: `node "${CLAUDE_SKILL_DIR}/scripts/cli.js" fetch --all --limit 1 --out-file setup-check.json`. If it fails with an auth or "not found" error, tell the user which value looks wrong (token vs space/environment), ask for it again, and save the new value with `setup`. To start over, run `setup --clear`.

### Step 0.5 — Ask what the user wants to do

**Q1, "What would you like to do?"**

| Option | Then |
|---|---|
| Generate SEO metadata | Ask Q2, then run Workflow steps 1–4 |
| Re-export existing drafts | Workflow step 4 on the existing `seo-metadata-work/generated-metadata*.json` |
| Apply reviewed metadata to Contentful | Workflow step 5. Dry run first; never write without approval |
| Check / update setup | Repeat step 0 and let the user change any value |

**Q2, "Which entries?"** (only for Generate). Ask it in the same picker call as Q3.

| Option | Ask for | Command |
|---|---|---|
| Single entry | slug or entry ID | `fetch --slug <slug>` / `fetch --entry-id <id>` |
| Multiple entries | a list of slugs or entry IDs | `fetch --slug a b c` / `fetch --entry-id x y z` |
| All entries missing metadata | optional max count | `fetch --all --only-missing [--limit n]` |
| A series or hub page | series value or hub slug | `fetch --series <v>` / `fetch --hub-slug <slug>` |

Only offer the series/hub option if the config sets `contentful.fields.series` or `contentful.hubContentType`. Name whichever one(s) are actually available.

**Q3, run options** (same picker call as Q2):
- Include unpublished drafts? Adds `--preview`. If no preview token is stored, ask for one and save it with `setup --preview-token`.
- Export format: Excel, JSON, or both. This becomes `export --format`.

When the fetch returns more than 20 entries, re-run it with `--chunk-size 20` and work chunk by chunk.

After export, show a short summary (rows, flagged rows, export path). Then ask: **"Stop here for review"** or **"Do an apply dry run"**. Apply always follows the approval rule in step 5.

## Workflow

### 1. Fetch entries

```
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" fetch --slug <slug> [<slug> ...]
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" fetch --entry-id <id> [<id> ...]
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" fetch --series <value>       # requires contentful.fields.series in config
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" fetch --all --only-missing
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" fetch --hub-slug <slug>       # requires contentful.hubContentType in config
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
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" derive --input seo-metadata-work/generated-metadata.json --fetched seo-metadata-work/fetched-entries.json
```

Both flags take several files (e.g. all the part files). Fills in `canonicalUrl` and `schema` on each row in place, from the config's `canonicalUrl` / `schema` templates and the fetched entry data. Rows that already have a value keep it unless `--force` is passed. A row whose URL can't be built (missing slug, no matching rule, no fetched entry) gets a `derive:` entry in `flags` instead of a guessed value — report those to the user.

Skip this step if the config has neither `canonicalUrl` nor `schema`.

### 4. Export for review

```
node "${CLAUDE_SKILL_DIR}/scripts/cli.js" export --input seo-metadata-work/generated-metadata.json --format both
```

`--input` accepts several files. If `--config` is given (or the default config file exists), validates against `rules.titleMaxLength` / `rules.descriptionMaxLength` / `rules.subtitleMaxLength` when set, and checks that `canonicalUrl` is absolute and `schema` is an object. Writes `seo-metadata-work/metadata-export.json` and/or `.xlsx`.

### 5. (Optional) Apply back to Contentful

**Never write to Contentful without the user's explicit approval** (see Hard rules). Steps 1–4 are read-only; this is the only step that changes Contentful.

1. Run the dry run and show the user exactly which entries, fields and locale would change:
   ```
   node "${CLAUDE_SKILL_DIR}/scripts/cli.js" apply --input seo-metadata-work/generated-metadata.json
   ```
   If the dry run fails with `has no linked "…" entry yet` (linkedEntry mode), those pages/articles have no SEO entry. Tell the user which ones, and ask whether to create and link new SEO entries for them. If yes, re-run the dry run with `--create-missing` and show its plan: for each such page it lists `would CREATE … and LINK it to …`, the fields set (including the config's `createDefaults`), and what happens to the page.
2. Ask the user to approve that specific write. Stop and wait — do not proceed without a clear "yes".
3. Only after approval, run the write with `--approved`:
   ```
   node "${CLAUDE_SKILL_DIR}/scripts/cli.js" apply --input seo-metadata-work/generated-metadata.json --write --approved [--create-missing]
   ```
   Keep `--create-missing` only if it was in the approved dry run. Add `--publish` only if the user separately and explicitly approved publishing.

   Creating a missing SEO entry also edits the page/article, because its link field changes. Without `--publish`, the new SEO entry and the page change both stay as drafts for editors to review and publish. With `--publish`, the new SEO entry is published, and the page is republished only if it had no other unpublished edits. Otherwise it's left as a draft and reported, so tell the user it needs publishing in Contentful.

Without `--approved`, `--write`/`--publish` prompts for a typed `yes` in an interactive terminal and refuses outright in a non-interactive shell. The planned changes are always printed before anything is written.

Requires `CONTENTFUL_MANAGEMENT_TOKEN` and `contentful.seoMetadata` in config. Writes every field that is both mapped in `contentful.seoMetadata` and present on the row (`--locale` picks the locale). Updates the entry in place (draft only, unless `--publish` is also passed). In `linkedEntry` mode it updates the linked SEO entry. If there is none, it fails, unless `--create-missing` is passed: then it creates a new SEO entry and links it to the page. In `inline` mode it updates the fields directly on the main entry. Works for any entry that has the configured link field (articles and hub pages alike). Non-localized fields are always written under the space's default locale.

## Hard rules (do not skip)

- **Never print, repeat, or commit credential values** (access, preview, or management tokens). Store them only via `setup`; never write them to a file in the project yourself. The one exception is the gitignored `.seo-metadata/credentials.json` that `setup --local` manages. Never read it directly either.
- **Never change anything in Contentful without the user's explicit approval — strictly.** Never run `apply --write`, `apply --publish`, or any other Contentful Management API write (create/update/publish/unpublish/delete — via this tool, curl, or any other means) unless the user has explicitly approved that specific write in the current conversation. Always run the dry run first, show the user what would change, and ask. Approval covers only that one run (same input, same flags) — a changed input, a new batch, or adding `--publish` or `--create-missing` needs fresh approval. Creating entries and changing a page's SEO link are writes too. Only pass `--approved` after receiving that approval. Never infer approval from earlier steps, a reviewed export, or general instructions to "finish the task".
- **Fail closed on missing/unreachable source content** — never fabricate a value the rule docs ask for. Flag it.
- Whatever the project's rule docs say about a compliance/safety screen, it always runs last and always wins over any SEO-score heuristic.
- **Never hand-write a Canonical URL or Schema** — they come from `derive` so they match the site's routing. If `derive` flags a row, surface it; don't patch the value by hand.
- **Never restate the Title verbatim in the Description**, unless the project's own rules say otherwise.
- Treat any character caps in the rule docs as hard limits — draft to fit, don't rely on `export`'s validator to catch it after the fact.
- Category/product alignment tagging (if the project uses it) is additive and optional — don't force a match that isn't genuinely there, and keep the reference data file up to date by hand.

## Files

All paths are relative to `${CLAUDE_SKILL_DIR}`.

- `vendor/` — the bundled dependencies (commander, SheetJS xlsx), so no `npm install` is needed.
- `config.example.json` — the config schema, with placeholders. Copy and fill in per project.
- `rules/*.template.md` — generic templates showing the shape a rule doc needs; not usable as-is. `subtitle-spec.template.md` is only needed if the project has a Subtitle field.
- `examples/payden-and-rygel/` — a fully filled-in worked example (config + rules + reference data, plus the original source PDFs in the git repo), for that specific project.

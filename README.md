# seo-metadata-skill

A Claude Code skill that generates SEO metadata (Title / Subtitle / Description / Keywords, plus a derived Canonical URL and Schema JSON-LD) for Contentful entries, following a **project-specific** config and rule set, and exports the result to JSON/Excel or applies it back to Contentful.

This skill ships with no built-in knowledge of any particular Contentful space, content type, or editorial rulebook — you configure those per project.

## Install as a Claude Code skill

```
npx skills add Payden-and-Rygel/seo-metadata-skill
```

Then see [SKILL.md](SKILL.md) for the full workflow.

## Configure for your project

```
npm install
cp .env.example .env                                 # CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN / ...
cp config.example.json ./seo-metadata.config.json     # describe your Contentful content type + fields
cp rules/title-spec.template.md ./rules/title-spec.md
cp rules/description-spec.template.md ./rules/description-spec.md
cp rules/keywords-spec.template.md ./rules/keywords-spec.md
# then fill in each of the above with your project's actual schema/rules
```

If your project already has a filled-in example under `examples/`, copy that instead — see `examples/payden-and-rygel/` for what one looks like end-to-end.

## Manual use

```
node bin/seo-metadata-skill.js fetch --slug <slug>
node bin/seo-metadata-skill.js fetch --all --only-missing --preview --chunk-size 20
node bin/seo-metadata-skill.js derive --input seo-metadata-work/generated-metadata.json --fetched seo-metadata-work/fetched-entries.json
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.json
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write
npm test
```

## What it does / doesn't do

- **Canonical URL and Schema are derived, not drafted** — `derive` builds them from URL/JSON-LD templates in your config plus the fetched entry, so they always match your site's routing.
- **Fetching and exporting are mechanical** (plain Contentful GraphQL/Management API calls, built from your config — no LLM involved).
- **Drafting the actual Title/Description/Keywords values requires judgment** — reading full entry bodies, applying whatever compliance rules your project defines, following your per-content-type templates, etc. That part is driven by Claude following [SKILL.md](SKILL.md) and your own `rules/*.md`, not by a deterministic script.
- Writing back to Contentful (`apply --write`) is opt-in and defaults to a dry run; it supports both a linked "SEO metadata" entry and inline fields on the entry itself, configurable per project.

## Examples

- [`examples/payden-and-rygel/`](examples/payden-and-rygel/) — a complete worked example (config, rules, reference data, and the original source PDFs) for payden.com's Contentful space.

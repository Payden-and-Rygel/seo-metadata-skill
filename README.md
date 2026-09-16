# seo-metadata-skill

A Claude Code skill that generates SEO metadata (Title / Description / Keywords) for Contentful article entries on payden.com, following the editorial rules in `references/`, and exports the result to JSON/Excel or applies it back to Contentful.

## Install as a Claude Code skill

```
npx skills add Payden-and-Rygel/seo-metadata-skill
```

Then see [SKILL.md](SKILL.md) for the full workflow.

## Manual use

```
npm install
cp .env.example .env   # fill in CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN

node bin/seo-metadata-skill.js fetch --slug <article-slug>
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.json
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write
```

## What it does / doesn't do

- **Fetching and exporting are mechanical** (plain Contentful GraphQL/Management API calls, no LLM involved).
- **Drafting the actual Title/Description/Keywords values requires judgment** — reading full article bodies, applying compliance screening, series-specific rules, etc. That part is meant to be driven by Claude following [SKILL.md](SKILL.md) and the specs under `references/`, not by a deterministic script.
- Writing back to Contentful (`apply --write`) is opt-in and defaults to a dry run; it only updates an entry's existing linked `seoMetadata` entry (draft, not published, unless `--publish` is also passed).

## Editorial specs

Condensed from Payden & Rygel's internal developer specs:
- [references/title-spec.md](references/title-spec.md)
- [references/description-spec.md](references/description-spec.md)
- [references/keywords-spec.md](references/keywords-spec.md)
- [references/strategy-fund-reference.json](references/strategy-fund-reference.json) — manually maintained, update when Payden launches/retires/renames a strategy or fund.

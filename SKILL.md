---
name: seo-metadata
description: Generate SEO metadata (Title/Description/Keywords) for Contentful article entries per Payden & Rygel's editorial spec, and export the result to JSON/Excel or apply it back to Contentful. Use when asked to fill in missing/generate CMS SEO metadata, audit article Title/Description/Keywords fields, or export metadata for review.
---

# SEO metadata generator (Contentful)

Generates the Contentful **metadata tab** fields — Title, Description, Keywords — for article/video entries, following Payden & Rygel's editorial specs. This skill does the *fetching* and *exporting* mechanically via bundled scripts; **you (Claude) do the actual drafting** by reading the fetched content and applying the rules below — this is judgment work, not a template fill-in.

## Setup (one-time)

```
cd seo-metadata-skill
npm install
cp .env.example .env   # fill in CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN
```

`CONTENTFUL_MANAGEMENT_TOKEN` is only needed for the optional `apply --write` step.

## Workflow

### 1. Fetch entries

```
node bin/seo-metadata-skill.js fetch --slug <slug>
node bin/seo-metadata-skill.js fetch --entry-id <id>
node bin/seo-metadata-skill.js fetch --series "Week in Review"
node bin/seo-metadata-skill.js fetch --all --only-missing
node bin/seo-metadata-skill.js fetch --hub-slug <point-of-view-hub-slug>
```

Writes raw entry JSON (title, slug, series, hero, content body, existing seoMetadata, etc.) to `seo-metadata-work/fetched-entries.json`.

### 2. Read the fetched content and draft metadata — this is the part you do

For **each** entry:

1. Determine its `series` value (`Economic Update`, `EM Monthly Commentary`, `EM Trip Notes`, `Market Insights`, `Point of View`, `Press Room`, `Research Papers`, `Week in Review`) — this gates everything below.
2. Read **[references/title-spec.md](references/title-spec.md)** and draft the **Title** per that series' template.
3. Read **[references/description-spec.md](references/description-spec.md)** and draft the **Description** — gate on series first (what to read), draft, run the SEO self-check, then **always run the compliance-safety screen last** (it overrides everything).
4. Read **[references/keywords-spec.md](references/keywords-spec.md)** and draft **Keywords** — content-based terms, then check strategy/fund alignment against `references/strategy-fund-reference.json` (additive, don't force it).
5. If required source material is missing or unreachable (streaming payload blind spot, iframe chart that won't load, no volume number stated, etc.) — **fail closed**: don't guess, add a note in a `flags` array on that row instead (e.g. `"flags": ["no on-page volume number, needs manual entry"]`).

Build a JSON array, one object per entry, shaped like:

```json
[
  {
    "entryId": "<contentful sys.id, from the fetched data>",
    "slug": "insights/example-article",
    "series": "Point of View",
    "title": "Wisdom Of The Crowd, Point of View Vol. 2 2026 | Payden & Rygel",
    "description": "...", 
    "keywords": ["term one", "term two", "Fixed Income Strategy"],
    "flags": []
  }
]
```

Save it, e.g. to `seo-metadata-work/generated-metadata.json`.

### 3. Export for review

```
node bin/seo-metadata-skill.js export --input seo-metadata-work/generated-metadata.json --format both
```

Validates the 256-char Title cap and 130-char Description cap, then writes `seo-metadata-work/metadata-export.json` and/or `.xlsx`.

### 4. (Optional) Apply back to Contentful

Only after a human has reviewed the export. Defaults to a dry run:

```
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write
node bin/seo-metadata-skill.js apply --input seo-metadata-work/generated-metadata.json --write --publish
```

Requires `CONTENTFUL_MANAGEMENT_TOKEN`. Updates the entry's linked `seoMetadata` entry (draft only, unless `--publish` is also passed). It never creates a new `seoMetadata` entry — if an article has none linked yet, create one in Contentful first.

## Hard rules (do not skip)

- **Fail closed on missing/unreachable source content** — never fabricate a headline, date, volume number, or performance figure. Flag it.
- **Compliance-safety screen always runs last** on the Description and always wins over the SEO score.
- **Never restate the Title verbatim in the Description.**
- **Character caps are hard limits**, checked programmatically by `export` (Title ≤ 256, Description ≤ 130) — but draft to fit, don't rely on the validator to catch it.
- **Strategy/Fund tagging is additive and optional** — don't force a match that isn't genuinely there, and keep `references/strategy-fund-reference.json` up to date by hand if Payden launches/retires/renames a product.

## Reference files

- [references/title-spec.md](references/title-spec.md) — full Title rules, per-series templates, hub/landing page exception.
- [references/description-spec.md](references/description-spec.md) — full Description rules, Point of View on-page-summary carve-out, compliance screen, SEO self-check rubric.
- [references/keywords-spec.md](references/keywords-spec.md) — full Keywords rules.
- [references/strategy-fund-reference.json](references/strategy-fund-reference.json) — static strategy/fund tagging reference list.

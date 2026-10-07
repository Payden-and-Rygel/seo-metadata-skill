# Example: payden.com

A fully filled-in example of this skill's config + rules, built from Payden & Rygel's actual Contentful schema and editorial specs (originals in `docs/`).

To use as a starting point for that project specifically:

```
cp examples/payden-and-rygel/config.json ./seo-metadata.config.json
cp -r examples/payden-and-rygel/rules ./rules
cp examples/payden-and-rygel/reference-data.json ./rules/reference-data.json
```

Then in `.env`, set `CONTENTFUL_SPACE_ID` / `CONTENTFUL_ACCESS_TOKEN` for the payden.com Contentful space, and `CONTENTFUL_ENVIRONMENT_ID=marketing-v2` (payden.com does not use the Contentful default `master` environment).

This is not loaded by default — the skill itself has no knowledge of Payden's schema or rules. See the root `config.example.json` and `rules/*.template.md` for the generic starting point any other project should use instead.

## Contents

- `config.json` — Contentful `Article` content type / field mapping, plus the `PointOfViewPage` hub content type.
  - **Canonical URL** follows payden.com's routing (`src/app/insights/...`). Articles linked from a `PointOfViewPage` use `https://www.payden.com/insights/point-of-view/<pov-slug>/<slug>`; every other article uses `https://www.payden.com/insights/<slug>`. Note that the site's `src/app/sitemap.ts` lists PoV articles only as `/insights/<slug>`, so it doesn't match these canonicals. That needs fixing on the website side.
  - **Schema** is written to `SeoMetadata.richResultSchema`. The site spreads it over its built-in Article JSON-LD, so this template only adds `description`, `keywords`, `datePublished`, `mainEntityOfPage` and author/publisher. It leaves headline, image and dateModified to the site.
  - **Subtitle** is off, because `SeoMetadata` has no subtitle field yet. Once one is added in Contentful, set `contentful.seoMetadata.subtitleField` and `rules.subtitleSpec` (start from `rules/subtitle-spec.template.md`).
- `rules/title-spec.md`, `rules/description-spec.md`, `rules/keywords-spec.md` — the actual editorial rules, transcribed from `docs/`.
- `reference-data.json` — the Strategy/Fund alignment-tagging reference list.
- `docs/` — the original developer-spec PDFs these rules were transcribed from.

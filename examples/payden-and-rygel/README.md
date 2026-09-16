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
- `rules/title-spec.md`, `rules/description-spec.md`, `rules/keywords-spec.md` — the actual editorial rules, transcribed from `docs/`.
- `reference-data.json` — the Strategy/Fund alignment-tagging reference list.
- `docs/` — the original developer-spec PDFs these rules were transcribed from.

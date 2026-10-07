# Subtitle field — generation rules (template)

Optional. Only needed if your SEO metadata has a Subtitle field: set `contentful.seoMetadata.subtitleField` and `rules.subtitleSpec` in your config. If `rules.subtitleSpec` is not set, the skill does not draft a subtitle.

Copy this to `rules/subtitle-spec.md` (or wherever `rules.subtitleSpec` points) and replace every `<...>` placeholder with your project's actual rules.

## 1. Purpose

State where the subtitle appears (an on-page dek, an Open Graph secondary line, a card teaser, etc.), since that decides its tone and length.

## 2. Shape

Define the template or style, for example:

```
<one sentence that adds context the Title does not already carry>
```

- Max character length (mirror it in `rules.subtitleMaxLength` so `export` enforces it).
- Must not restate the Title, or the Description, word for word.

## 3. Source priority

List, in priority order, where the content comes from (e.g. hero eyebrow text → summary → first paragraph of the body).

## 4. Per-content-type differences (if any)

| Content type / series | Rule |
|---|---|
| `<Series A>` | `<rule>` |

## 5. Fail-closed checklist

What to do when the source content is missing. The default is to leave `subtitle` empty and add a `flags` entry, not to guess.

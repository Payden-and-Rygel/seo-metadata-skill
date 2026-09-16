# Title field — generation rules (template)

Copy this to `rules/title-spec.md` (or wherever your `config.json`'s `rules.titleSpec` points) and replace every `<...>` placeholder with your own project's actual rules. This template shows the *shape* a working spec needs, not real content — see `examples/payden-and-rygel/rules/title-spec.md` for a fully filled-in example.

## 1. Universal shape

Define the fixed string template every title should follow, e.g.:

```
{distinguishing content}, {category label} | <Your Brand Name>
```

Explain, in order:
- What counts as "distinguishing content" for a piece (headline? date? volume number?).
- What the category/series label is and where it comes from.
- Any fixed brand suffix.

## 2. Source priority for distinguishing content

List, in priority order, where to pull the distinguishing content from (e.g. on-page headline → hero image caption → URL slug). Include a sanity check for verifying the candidate against the URL slug or another ground truth.

State the max character length for the whole title string.

## 3. Per-content-type / per-series formats

A table mapping each content type or series to its own template and an example, e.g.:

| Series | Template | Distinguishing content = |
|---|---|---|
| `<Series A>` | `<template>` | `<source>` |
| `<Series B>` | `<template>` | `<source>` |

Note any structural exceptions (a content type with no series label at all, etc.) and how to detect which bucket a given entry falls into.

## 4. Hub/landing pages (if applicable)

If your project has table-of-contents-style pages with no single narrative, define a simpler template for those and how to detect them.

## 5. Automation checklist

A short ordered checklist for what to do when a required field is missing on the page — the default should be **fail closed / flag for manual entry**, not guess.

## 6. Retired/rejected formats (optional)

Document any old convention that should NOT be used going forward, so it isn't accidentally reintroduced.

# Title field — generation rules

Source: `docs/Metadata Rule for - TITLE.pdf` (Payden & Rygel developer spec).

Governs the Contentful **Title** field (metadata tab) for every published article/video. Goal: front-load the piece's own distinguishing content, since browser tabs and search snippets truncate around 20-30 characters.

## 1. Universal shape

```
{distinguishing content}, {generic series/category label} | Payden & Rygel
```

- **Distinguishing content** — whatever makes this piece different from every other piece in the same series (headline, date, volume number, month/period, trip destination). Always first.
- **Series/category label** — the generic bucket this piece belongs to. Always second.
- **Brand suffix** — literally `| Payden & Rygel`, fixed, always last.

Rule of thumb: if you covered up everything after the first comma, could someone still tell which specific piece this is? If not, the order is wrong.

Two exceptions to the three-part shape: hub/landing pages (section 4) and Research Papers (no series-label clause at all).

## 2. Finding "distinguishing content" (source priority)

First one found wins:
1. A real editorial headline genuinely present and prominent in the page body (not a nav label or generic subheading).
2. Text tied to the hero banner image itself (caption, alt text, overlay copy).
3. Constructed from the URL slug + core theme of the body, written as a clean headline (not a filename).

**Sanity check:** compare the candidate against the URL slug before finalizing. If they don't reasonably match, you probably grabbed a subheading instead of the real title.

**Max length: 256 characters total** (whole title string).

## 3. Per-series formats

| Series | Template | Distinguishing content = |
|---|---|---|
| Week in Review | `{Headline}, {DATE_ISO} Week in Review \| Payden & Rygel` | On-page headline + displayed publish date (`YYYY-MM-DD`) |
| EM Monthly Commentary | `{Month} {Year} Monthly Commentary, Emerging Markets \| Payden & Rygel` | The commentary *period* covered (not the publish date) |
| EM Trip Notes | `{Title}, Trip Notes \| Payden & Rygel` | Exact on-page title, as-is (no paraphrasing) |
| Point of View (individual article) | `{Leading Title}, Point of View Vol. {N} {Year} \| Payden & Rygel` | Leading/starting portion of the article's own title; volume + year exactly as stated, no comma between them |
| Economic Update | `{Full headline}, {Report/Series Name} \| Payden & Rygel` | Full on-page headline (not truncated) + the specific report name (not the umbrella "Economic Update") |
| Research Papers | `{Article Title} \| Payden & Rygel` | The paper's own on-page title — **no series-label clause at all** (structural exception) |
| Any other/new series | `{distinguishing detail}, {Series Name} \| Payden & Rygel` | Date, month/period, volume/edition number, or exact on-page title |

Confirmed examples: `Running Dry, 2026-08-07 Week in Review | Payden & Rygel`; `Wisdom Of The Crowd, Point of View Vol. 2 2026 | Payden & Rygel`.

Notes:
- Series/category label is detected from the page's own category tag, breadcrumb, or URL path segment — never guessed from tone.
- Volume/edition numbers are never inferred or incremented — if not explicit on the page, flag it.
- Casing: **"Week in Review"** — lowercase "in" (differs from Title Case used elsewhere).
- Research Paper is a structural exception, not just another row — confirm via category/breadcrumb before applying, ask if ambiguous.

## 4. Hub/landing pages (exception to section 1)

A hub page is a table-of-contents for a volume/issue — multiple distinct articles, no single narrative. Detect via multiple article-specific slug links nested under the same path.

```
{Series Name} Vol. {N} {Year} | Payden & Rygel
```
or, for a non-volume-numbered series:
```
{Series Name}: {period} | Payden & Rygel
```
Confirmed example: `Point of View Vol. 2 2026 | Payden & Rygel`.

## 5. Automation checklist

1. Fetch the live/full page content (some content only exists in a streaming payload, not rendered HTML).
2. Determine content type: single article vs. hub/landing page.
3. Determine series (category tag / breadcrumb / URL segment).
4. Extract distinguishing content per section 2, using the field mapping for that series.
5. Run the slug-match sanity check.
6. Assemble per the template.
7. Enforce 256-char max.
8. **If any required field (volume number, date, series name) is missing, don't guess — flag for manual entry.**

## 6. Retired format (do not use)

`Payden {Series Name}: {Title}` — burns the truncation-visible window on a generic prefix. Legacy only, never replicate.

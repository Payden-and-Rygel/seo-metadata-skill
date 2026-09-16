# Description field — generation rules

Source: `docs/Metadata Rule for - DESCRIPTION.pdf` (Payden & Rygel developer spec, final version).

Governs the Contentful **Description** field (metadata tab) — this doubles as the meta description shown in search results, with no disclaimer next to it, so it must be accurate and compliant standing on its own. **Every description is freshly generated every time** — there is no "reuse existing approved copy" tier.

## 1. Process (run in this order)

1. Gate on series type — determines what gets read (section 2).
2. Read the source content (full body, or just the top paragraph, depending on series).
3. Draft the summary — always freshly generated.
4. Improve for SEO/AI against the rubric (section 5 below / "SEO/AI self-check").
5. **Run the compliance-safety screen last** — it overrides everything before it, even if it costs the SEO score.

## 2. What gets read (series-specific gate)

- **Point of View**: check for an on-page summary blurb first (see 2a) — takes priority over the full-length rule.
- **Full-length pieces** (Monthly Commentary, Research Papers, Trip Notes, Economic Update, POV with no on-page summary): read and analyze the **entire article body**. Never generate from headline/slug/single paragraph alone.
- **Week in Review**: read **only the top/opening narrative paragraph**. "Highlights of the Week" is never pulled in — no exceptions, it recurs with the same fixed categories every issue.
- **Hub/landing pages**: no single body — build from the linked articles' own leading title portions (section 6 below).
- Title/subtitle inform context but are not source material — description must not restate the Title.

## 2a. Point of View — on-page summary carve-out (confirmed 2026-08-19)

Many Point of View pieces carry a short editorial summary blurb on the page (beneath the headline, above "Back to Library"/TOC, before the body). It is distinct from both the body's opening paragraph and the meta description tag — verify against the actual rendered page, don't trust a single automated fetch (confirmed case where a first-pass fetch fabricated a summary that didn't match the real page).

**If the summary exists: use it verbatim.** Don't rewrite/paraphrase.
- Under 130 chars: use as-is.
- Over 130 chars (common case): **truncate at the last full word boundary** — do NOT compress/rewrite (defeats the purpose of verbatim reuse).
- Still run the compliance-safety screen over the result.

If no summary exists, fall back to the standard full-length-piece process.

## 3. If the full source can't be reached

**Fail closed.** If a streaming-payload or lazy-loaded-iframe blind spot blocks the body (or a chart doesn't load), don't guess/fabricate — flag it and let the user decide.

## 4. Performance figures — restricted, not banned

A specific performance/return/yield figure may appear **only if already written verbatim in the article's own text** — never inferred/calculated/estimated. Even then, not the default — stay general/qualitative unless one number is clearly the single substantiated point that matters.

## 5. Compliance-safety screen — hard override, final gate

Screen against:
- No performance guarantees/promises ("will outperform," "guaranteed returns").
- No absolute/certainty language ("always," "never," bare "will").
- No individualized investment directives ("investors should," "you should buy/sell").
- No unqualified superlatives/rankings unless attributed to a named cited source.
- Hedge forward-looking statements ("may," "could," "is likely to").
- Past performance not framed as predictive.
- Favor attributive framing ("discusses," "shares her view on") over declarative market calls ("bonds are back").
- No bare performance figures beyond what section 4 allows.

If any phrase trips one of these, rewrite toward the safer/hedged version automatically. Anything genuinely borderline gets flagged to a human, not resolved silently.

## 6. Tone/voice

Attributive, professional, concise.

## 7. Character cap — 130 max, hard rule

Check `.length` programmatically. **Default to compressing/rewriting to fit first**; only truncate at the last full word boundary when a rewrite genuinely can't fit. Never truncate mid-word, never use an ellipsis that eats the budget.

## 8. Recurring-series rule

Never open with the same fixed preamble every time (e.g. "Payden's Week in Review looks at..." verbatim, week after week) — search engines discard boilerplate patterns at scale. Open with the piece's specific content; series identity already lives in the Title field.

## 9. SEO/AI self-check (internal heuristic only, never shown to the user as a real tool's output)

Score /100 across 4 equal categories:
- **Length utilization** (25 pts): 110-130 chars = 25; 90-109 = 18; 70-89 = 10; under 70 = 5.
- **Front-loaded specificity** (25 pts): concrete entity/event/figure in first ~60 chars = 25; present but later = 12; purely generic = 0.
- **Keyword alignment** (25 pts): top-3 keyword verbatim/near-verbatim = 25; related non-matching term = 12; no overlap = 0.
- **Distinct from Title** (25 pts): adds info beyond Title, no verbatim phrase lifted (brand/series exempt) = 25; partial restatement = 12; mostly a rephrase = 0.

Bands: 90-100 ship as-is. 70-89 acceptable (note weakest category). Below 70, revise once and re-score — don't loop chasing 100. **Compliance screen (section 5) always overrides this score.**

## 10. Hub/landing page sourcing

```
Payden's {Series Name} Vol. {N}, {Year}: {Title 1}, {Title 2}, {Title 3}, {Title 4}
```
Same 130-char cap and full compliance screen still apply.

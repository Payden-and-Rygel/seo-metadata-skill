# Keywords field — generation rules

Source: `docs/Metadata Rule for - KEYWORDS.pdf` (Payden & Rygel developer spec).

Governs the Contentful **Keywords** field (metadata tab). Two distinct, additive parts — never one replacing the other; total count can run past 10.

## 1. Content-based keywords (baseline, ~10 terms)

Pull roughly 10 terms directly from the article's actual body content — named entities, specific topics, themes genuinely present (countries, institutions, policy actions, asset classes, etc.).

Rank by **relevance**, not raw frequency — frequency-based extraction surfaces filler words.

**Hub/landing pages**: skip content-specific extraction entirely (linked articles can span unrelated topics). Use generic series/volume identifiers instead. Confirmed example: `Point of View, Payden Point of View, Point of View Vol. 2, Point of View Vol. 2 2026, Payden & Rygel Insights`.

## 2. Strategy & Fund alignment tagging (additive)

Purpose: surface articles on the matching Strategy/Fund page's backend filter.

After drafting content-based keywords, check alignment against `references/strategy-fund-reference.json`:

- **Broad category match** (discusses a strategy category generally): tag the generic category label, singular — `Fixed Income Strategy`, `Equity Strategy`, `Unconstrained Strategy`, `Balanced Strategy`.
- **Specific match** (aligns with one named sub-strategy/fund): tag with the exact name, or confirmed alias.
- **Both can apply** (e.g. Core & Core Plus Strategy / Core Bond Fund) — tag both.
- **Don't force it.** Only tag when genuine alignment exists — a loose/generic connection doesn't count.

Fund tagging is at the fund-family level — never tag individual share classes separately.

Only one confirmed alias today: `"Core Bond"` = `"Core & Core Plus Strategy"`. Unlisted nicknames cannot be inferred — flag if uncertain rather than guessing a match.

## 3. Reference list

See `references/strategy-fund-reference.json` — static, manually maintained, reflects payden.com as of 2026-08-19. **Whoever owns this skill must update it by hand** when Payden launches/retires/renames a strategy or fund. There is no automatic sync.

## 4. Output format

Each keyword (content-based and strategy/fund tags alike) is a discrete string in a flat array — no nested structure, no punctuation beyond the term itself.

## Known open gaps (don't guess past these — flag instead)

- No rule on singular vs. plural form for content-based keywords.
- No rule on mixing branded vs. generic terms within the ~10 content-based keywords.
- No enforced minimum/maximum count — "roughly 10" is not a hard rule.
- No guidance for a thin piece that can't support 10 distinct relevant terms.

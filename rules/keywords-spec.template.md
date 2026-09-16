# Keywords field — generation rules (template)

Copy this to `rules/keywords-spec.md` and replace the placeholders. See `examples/payden-and-rygel/rules/keywords-spec.md` for a fully filled-in example.

## 1. Content-based keywords

Define roughly how many terms to pull directly from the body content, and how to rank them (relevance, not raw frequency). Note any content types (e.g. hub/landing pages) that should skip content-based extraction entirely and use generic identifiers instead.

## 2. Category/product alignment tagging (if applicable)

If your organization wants entries additionally tagged against a fixed reference list (product lines, categories, business units, etc.) for backend filtering, define:
- The broad-category vs. specific-match distinction.
- That this is **additive**, never replacing the content-based keywords.
- That it should never be forced — only tag a genuine match.

Point to `rules/reference-data.example.json` (or your own copy) as the static reference list, and note that it must be maintained by hand.

## 3. Output format

State the expected shape (e.g. a flat array of strings).

## Known open gaps (optional)

Anything intentionally left undecided (singular/plural form, min/max count, etc.) so it doesn't get silently guessed at.

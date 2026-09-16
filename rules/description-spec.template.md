# Description field — generation rules (template)

Copy this to `rules/description-spec.md` and replace the placeholders with your own project's rules. See `examples/payden-and-rygel/rules/description-spec.md` for a fully filled-in example.

## 1. Process

Define the order of operations, typically:
1. Gate on content type/series — what should be read.
2. Read the source content.
3. Draft a fresh summary.
4. Improve against an SEO/AI rubric.
5. Run a compliance/safety screen **last**, with veto power over everything before it.

## 2. What gets read (per content type/series)

For each content type or series, state exactly what should be read: the full body, just an opening paragraph, an on-page summary blurb if one exists, etc. Note any carve-outs (e.g. "if an approved summary blurb already exists on the page, reuse it verbatim instead of drafting a new one").

State explicitly that the description must not just restate the Title.

## 3. If the source can't be reached

Define a **fail-closed** rule: if the content is blocked (behind a script tag, an iframe, lazy-loaded, etc.), don't guess or fabricate — flag it for a human.

## 4. Compliance / safety screen

List the hard rules a generated description must never violate for your domain (e.g. no unqualified guarantees, no absolute language, no directives aimed at the reader, hedge forward-looking statements, don't restate specific figures unless verbatim in source). This step should always override the SEO rubric below.

## 5. Character cap

State the hard character limit and whether to compress-then-truncate or truncate-only, and where to truncate (word boundary, no ellipsis eating the budget).

## 6. Recurring-series rule (if applicable)

If some content publishes on a fixed cadence, forbid a repeated boilerplate opening — lead with the piece's own substance each time.

## 7. SEO/AI self-check rubric (optional)

An internal scoring heuristic (never presented to the user as a real tool's output) to sanity-check length utilization, front-loaded specificity, keyword alignment, and distinctness from the Title.

## 8. Hub/landing page sourcing (if applicable)

Define how to build a description when there's no single body to summarize (e.g. from the leading titles of linked entries).

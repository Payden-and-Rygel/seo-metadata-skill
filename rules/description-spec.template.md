# Description field — generation rules (template)

Copy this to `rules/description-spec.md` and replace the placeholders with your own project's rules. See `examples/payden-and-rygel/rules/description-spec.md` for a fully filled-in example.

## 1. Process

Define the order of operations, typically:
0. Prerequisite: draft Keywords first if the self-check scores against them.
1. Gate on content type/series — what should be read.
2. Read the source content and record what was read.
3. Identify the piece's takeaway; check whether the series angle is supported.
4. Draft one sentence following the sentence structure and the approved examples.
5. Fit to the character cap.
6. Readability gate (pass/fail).
7. Improve against an SEO/AI rubric.
8. Run a compliance/safety screen **last**, with veto power over everything before it. If it rewrites the draft, re-run the cap and readability gate.

## 2. What gets read (per content type/series)

For each content type or series, state exactly what should be read: the full body, just an opening paragraph, an on-page summary blurb if one exists, etc. Note any carve-outs (e.g. "if an approved summary blurb already exists on the page, reuse it verbatim instead of drafting a new one" — and say how it is shortened if it exceeds the character cap, and that it still goes through the compliance screen, with any edit flagged for review).

Recommended: give each series its own short profile — what to read, what to lead with, how to handle crediting the organisation, series-specific watch-outs, and a pointer to its examples — so gaps per series are easy to spot.

State what happens for a content type the spec doesn't list (recommended: flag it, don't improvise).

State explicitly that the description must not just restate the Title.

## 2b. Record what was read

Require each output row to record what the description was drafted from (e.g. `full body (~1,400 words)`, `opening paragraph`, `on-page summary, verbatim`), so a reviewer can confirm the read rule was followed. If only the headline, slug or keywords were available, fail closed. Make sure the export script carries this field through.

## 3. If the source can't be reached

Define a **fail-closed** rule: if the content is blocked (behind a script tag, an iframe, lazy-loaded, etc.), don't guess or fabricate — flag it for a human.

## 4. Takeaway and series angle

Require the description to name the piece's question or takeaway, not just list topics. Give each series one line on what to lead with (e.g. "Trip Notes: lead with the on-the-ground perspective"), used only when the body supports it. Define the fail-closed behaviour: angle unsupported → draft without it and flag; no takeaway → leave empty and flag. No filler.

## 5. Sentence structure

Define the sentence shape: e.g. one complete sentence with a main verb, no bare "we". If the organisation or a named team/author is credited, say where the credit goes (at the start as the subject, never appended at the end). Recommended: no credit by default — write content-first and hedge forward-looking claims; credit the organisation only when a hedged sentence still reads as a market call, keep the credit short, and don't name individuals. List any content exempt from this (reused summaries, hub pages).

## 6. Compliance / safety screen

State a general rule first — recommended: no word or phrase that might raise a compliance question; when in doubt, leave it out — and give a minimum red-flag word list by type (guarantees, value claims, superlatives, advice, positions, forecasts stated as fact, hype) with neutral alternatives. Then list the hard rules a generated description must never violate for your domain (e.g. no unqualified guarantees, no absolute language, no directives aimed at the reader, hedge forward-looking statements, don't restate specific figures unless verbatim in source). If you favour attributive framing, say where the attribution goes. This step should always override the SEO rubric below.

## 7. Character cap

State the hard character limit, applied to every description without exception. Recommended: fit by rewriting, never by cutting a sentence off partway, and no ellipsis. If a compliant, complete sentence can't fit, flag it rather than ship a fragment.

## 8. Recurring-series rule (if applicable)

If some content publishes on a fixed cadence, forbid a repeated boilerplate opening — lead with the piece's own substance each time.

## 9. Readability gate (pass/fail)

Before any scoring, read the description aloud as a standalone sentence. Define the fail conditions, e.g.: not a complete sentence; attribution at the end; a dangling trailing clause ("as…", "ahead of…"); ends on a conjunction/article/preposition; a topic list with no takeaway; only makes sense next to the Title. A failure blocks the description regardless of its score.

## 10. SEO/AI self-check rubric (optional)

An internal scoring heuristic (never presented to the user as a real tool's output), run only after the readability gate passes, to sanity-check length utilization, front-loaded specificity, keyword alignment, and distinctness from the Title.

## 11. Hub/landing page sourcing (if applicable)

Define how to build a description when there's no single body to summarize (e.g. from the leading titles of linked entries — whole titles only, never cut one partway).

## 12. Examples (few-shot)

For each series, include 2–3 approved examples and at least one labelled "avoid" example with a one-line reason. Examples steer the output more than the rules above; only add copy that has been reviewed and approved as a "good" example.

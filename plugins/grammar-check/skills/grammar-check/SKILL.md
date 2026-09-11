---
name: grammar-check
description: Grammarly-style writing check — correctness, clarity, engagement, delivery — with numbered fixes, a computed score, a deterministic AI-pattern score and an optional apply-fixes pass. Use when asked to grammar-check, proofread or tighten a file or pasted text.
argument-hint: "[file path | pasted text]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node ${CLAUDE_SKILL_DIR}/detector.mjs *)
---

# Grammar Check

Check the user's writing the way Grammarly does: four categories, concrete
numbered fixes, then offer to apply them.

Input: **$ARGUMENTS**

## 1. Resolve the input — follow this rule, do not improvise

| Condition (test in order) | Action |
|---|---|
| `$ARGUMENTS` is empty | Ask the user to paste text or give a file path. **Stop.** |
| `test -f "$ARGUMENTS"` succeeds | `MODE=file`. Read it. Report issues with line numbers. |
| otherwise | `MODE=inline`. Treat `$ARGUMENTS` verbatim as the prose to check. |

In `file` mode on a `.md` file, never flag anything inside fenced code blocks,
inline code, URLs, or YAML frontmatter. Those are not prose.

## 2. Deterministic pass — run this first, always

In `file` mode, run the detector on the file itself. In `inline` mode, first
write the prose to `$TMPDIR/gc-input.txt` and run it on that:

```bash
node ${CLAUDE_SKILL_DIR}/detector.mjs <file>
```

It prints JSON (`words`, `points`, `score`, `label`, and `issues` with `type`,
`line`, `text`, `severity`, `hint`) and gives a reproducible **AI-pattern
score**. Read its direction correctly:

> **0 = Clean. Higher = more AI-sounding.** It is the inverse of a quality
> score: under 10 "Clean", 10–29 "Some AI patterns", 30–59 "Moderate AI
> signals", 60+ "Heavy AI signals".

Never relabel it as a quality or grammar score, and never invent a value for it.
If `node` is missing or the command errors, **say so plainly in the report** and
mark the Engagement score `unavailable` — do not silently estimate it.

The detector skips code, URLs and frontmatter too. It catches AI-sounding
vocabulary, stock phrases, sentence shapes and rhythm only. It does **not**
catch grammar. It will miss `its`/`it's`, `alot`, and subject–verb
disagreement. Those are yours to find in step 3.

## 3. Judgment pass — four categories

No grammar engine is installed, so correctness is your responsibility. Read
carefully, twice.

Classify every issue into exactly one category, and one severity:

**CORRECTNESS** — spelling, subject–verb agreement, tense consistency, its/it's,
their/there, your/you're, plurals vs. possessives, comma splices, run-ons,
dangling modifiers, missing or doubled punctuation. *Severity: critical.*

**CLARITY** — wordiness, redundancy, buried subjects, unnecessary passive voice,
sentences over ~35 words doing more than one job, vague `This`/`That` openers
with no following noun. *Severity: moderate.*

**ENGAGEMENT** — bland or repeated verbs, filler ("very", "really", "quite"),
nominalizations, and every issue the step-2 detector returned. *Severity: minor,
except detector `severity: high` items, which are moderate.*

**DELIVERY** — tone consistency, hedging that undercuts the point, formality
mismatched to the evident audience. *Severity: minor.*

Rules that keep this honest:
- Quote the text exactly as written. Never paraphrase a quote into an error.
- Every issue needs a concrete replacement, not a note that something "could be
  improved". If you cannot write the fix, drop the issue.
- Preserve the author's voice. Deliberate fragments, an idiosyncratic rhythm, and
  regional usage (including Indian English) are **not** errors. Flag a real
  mistake, never a style you would have written differently.
- Zero issues is a valid result. Say the writing is clean rather than
  manufacturing something to report.

## 4. Score — compute, do not estimate

```
score = 100 − (5 × critical) − (2 × moderate) − (1 × minor)     floor at 0
```

Same issue list must always give the same score. Show the arithmetic in the
report so it can be checked.

## 5. Report — use this format

```
GRAMMAR CHECK — <filename or "pasted text">
<N> words · <N> issues · score <N>/100  (100 − 5×<c> − 2×<m> − 1×<n>)
AI-pattern score: <N>/100 — <label>  (0 = clean, higher = more AI-sounding)

CORRECTNESS <n>   CLARITY <n>   ENGAGEMENT <n>   DELIVERY <n>

CORRECTNESS
 1. L<line> · <one-line reason>
    - <exact text as written>
    + <exact replacement>

CLARITY
 2. …
```

Order categories Correctness → Clarity → Engagement → Delivery; number issues
continuously. Omit any category with zero issues. Keep each reason to one line.

Close with a single sentence naming the one change that would most improve the
piece.

## 6. Applying fixes

**Never edit anything in this step without being asked.** After the report, offer:

> Apply all fixes / correctness only / pick by number / leave it

In `file` mode, apply the chosen fixes with `Edit`, then re-run step 2 and report
the new AI-pattern score. In `inline` mode, print the corrected text in full.

If the user asked to apply fixes and any could not be applied cleanly, list those
explicitly. A partial application reported as complete is a failure.

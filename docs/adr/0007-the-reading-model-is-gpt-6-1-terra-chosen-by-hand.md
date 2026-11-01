# 0007. The reading model is `openai/gpt-6.1-terra`, chosen by hand

- Status: accepted
- Date: 2026-11-01
- Amends: [0005](0005-the-card-is-read-by-a-langgraph-graph-over-openrouter.md)

## Context

ADR-0005 has `benchmark_intake` pick the cheapest model with 1.00 on date,
"repeat on" and diseases, no record missing or extra, on every one of three
runs. No candidate reached that bar.

The final run ([`docs/benchmark/card-reading.md`](../benchmark/card-reading.md))
left two finalists:

| model | records | date | repeat on | diseases | cost per card |
| --- | --- | --- | --- | --- | --- |
| `anthropic/claude-sonnet-5.5` | 16/16 | 1.00 | 0.93 | 1.00 | $0.057 |
| `openai/gpt-6.1-terra` | 16/16 | 1.00 | 0.93 | 1.00 | $0.014 |

Both miss the same single field, in some runs and not others: a "repeat on"
date whose day was written over another digit, read one day early. Everything
else they miss (a lot number, a CRMV) does not move a reminder.

Earlier rounds ruled out the rest: `anthropic/claude-haiku-5.5` and
`google/gemini-3.8-flash` misread dates (Gemini read a whole card's year as
2024), `qwen/qwen3.8-27b` and `openai/gpt-6-luna` missed records and diseases,
and `z-ai/glm-5.3-flash` invented records.

## Decision

- **`INTAKE_MODEL=openai/gpt-6.1-terra`.** It reads the decisive fields as well
  as the other finalist at a quarter of the price.
- **The benchmark's bar stays as written**, and a maintainer may choose a
  model that misses it, in an ADR that names the misses. The command still
  reports "no model passed" and configures nothing on its own.

## Consequences

- An overwritten date can come back off by a day. The tutor confirms every line
  of a reading before it becomes a record, and the first reminder goes out
  seven days ahead.
- A new candidate or a prompt change is judged by rerunning the benchmark; a
  model that clears the bar replaces this one without a new ADR.

## Rejected

- **Lowering the bar to 0.93 on the decisive fields.** It would let a model
  miss a clearly written date as easily as an overwritten one.
- **Marking the overwritten record in the answer key and tolerating misses
  there.** Better in principle, but it changes the key's schema for one field
  on one card.

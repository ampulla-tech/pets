# 0005. The card is read by a LangGraph graph over OpenRouter, and the model comes from a benchmark

- Status: accepted
- Date: 2026-10-31

## Context

Loading an animal's history by hand means typing every line of a paper card:
dates, brands, lots, the diseases covered, the "repeat on", the vet. The cards
come from different clinics in different layouts, with handwriting, stickers,
crossed-out fields and two labels for one dose. Vision models read them with
varying success and at very different prices.

## Decision

- **A LangGraph graph** (`backend/intake/reading.py`) over **OpenRouter**
  (`langchain-openrouter`): one node sends the photos as image blocks and asks
  for structured output (`with_structured_output`, `json_schema`); the next
  cleans the answer against the domain (diseases outside the species' closed
  list dropped, unreadable values emptied, malformed dates marked unread).
- **Every field is `{value, read}`.** A field the model could not read comes
  back empty with `read: false`, never guessed. "Repeat on" also says its
  `origin`: `written` in its box, or `inferred` from a lone future date on the
  line below.
- The prompt carries the card's reading rules: two labels of one application
  are one record; a blank field is empty; a crossed-out field is its final
  reading; a weight written in a box is a weight record of its own; diseases
  from the closed list, inferable from the product's letters; a two-digit year
  is 20xx and a crossed 7 is a 7.
- **The model proposes, only a tap writes.** A reading is a list of proposals;
  the tutor corrects, confirms or discards each line, and only a confirmation
  writes a record, with the whole photos attached to it.
- The reading runs **outside the request**: the upload answers at once and a
  worker process (`run_intake_worker`) reads it; the client follows the state
  (`processing`, `ready`, `failed`).
- **The model is chosen by a benchmark and set in configuration**
  (`INTAKE_MODEL`), never in the code. `benchmark_intake` runs each candidate
  three times over the evaluation cards against their confirmed answer key,
  scores each field after normalisation by the worst run, and the winner is the
  cheapest with 1.00 on date, "repeat on" (value and origin) and diseases and no
  record missing or extra. The evaluation set (the photos and the key) holds
  third-party personal data, so it is read from a path and never committed;
  the committed report holds aggregate scores only
  (`docs/benchmark/card-reading.md`).

## Consequences

- With no key or no model configured, a reading fails as `unconfigured` and the
  manual forms still work, with the photo attached.
- Changing the model is a configuration change, after a new benchmark run.
- Visits and exams are never read by the model: their attachments are files
  only.

## Rejected

- **pydantic-ai**, used elsewhere for agents. The maintainer chose LangGraph for
  this reading.

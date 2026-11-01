# Card reading benchmark

Run on 2026-11-01: 3 run(s) per model over the evaluation cards; each score is the worst run. Fields are compared after normalisation; a record is matched by kind, date and diseases.

| model | records | date | repeat_on | diseases | brand | lot | lot_expiry | crmv | dose | weight | cost/card | p50 latency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `anthropic/claude-sonnet-5.5` | 16/16 | 1.00 | 0.93 | 1.00 | 1.00 | 1.00 | 1.00 | 0.92 | 1.00 | 1.00 | $0.0569 | 19.3s |
| `openai/gpt-6.1-terra` | 16/16 | 1.00 | 0.93 | 1.00 | 1.00 | 0.83 | 0.92 | 0.92 | 1.00 | 1.00 | $0.0135 | 23.6s |

**No model passed**: none had 1.00 on date, repeat_on and diseases with every record found and none extra on every run. No model is configured.

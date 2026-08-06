# AI layer

The platform ships with deterministic heuristics today and a fixed seam for
models later. Nothing in the app calls a model directly — every consumer goes
through `src/lib/ai/classifier.ts`.

## Current behaviour

| Function | Today | Consumed by |
| --- | --- | --- |
| `suggestCategory(text)` | Albanian/English keyword match | `createReportAction`, composer hint |
| `predictPriority(input)` | Danger-word + category rules | `createReportAction` → `reports.ai_priority_guess` |
| `duplicateScore(a, b, km)` | Jaccard title overlap + proximity decay | duplicate panel in the report page |
| `classifyImage(url)` | returns `null` | reserved |

## Why the results are advisory

`reports.ai_category_guess`, `ai_confidence` and `ai_priority_guess` are stored
**next to** the citizen's own choices, never over them. The UI shows a
suggestion chip; a human always confirms. That keeps a future model swap from
silently changing what a report claims, and it makes the heuristics' accuracy
measurable — compare the guess column against the final human value.

## Swapping in a model

1. Reimplement the function bodies. The signatures are the contract; no call
   site changes.
2. Because actions run on the server, an API key stays in `process.env` and
   never reaches the browser.
3. Keep them non-throwing. `createReportAction` treats classification as
   best-effort — a model outage must not block a citizen filing a report. Wrap
   remote calls in try/catch and fall back to the heuristic.
4. Model calls add latency to report creation. Past ~300ms, move the call out of
   the request: write the report first, then enrich it from a queue or a cron
   route, updating the `ai_*` columns in place.

## Duplicate detection

`findNearbyReports` (in `src/server/queries/reports.ts`) does the cheap work in
the database: a bounding-box scan on the `(latitude, longitude)` index limited
to the same category and open statuses. `duplicateScore` then ranks those few
candidates in memory. Embedding-based similarity would replace the ranking step
only — the box query stays as the recall filter.

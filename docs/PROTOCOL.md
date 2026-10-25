# Semantic protocol1.4 candidate (reads1.0 /1.1 /1.2 /1.3 history)

Local preview.11-dev.0 uses protocol1.4 with [explicit role/effect consistency checks](DECLARATION-CHECKS.zh-CN.md). Published preview.9/10 use protocol1.3. See [source mapping and validation limits](GROUNDING-FOLLOWUP.zh-CN.md). Published preview.8 remains protocol1.2.

The DSH model-facing tool is `dsh_semantic_ui`:

1. `{"action":"catalog"}` returns only this renderer's supported components, data requirements, local controls and explicit state/feedback limits. It does not infer another plugin's capability or implement an external protocol.
2. `{"action":"describe","component":"ArchitectureExplorer"}` returns the selected payload schema, envelope and semantic rules.
3. `{"action":"templates"}` lists private personal templates; `{"action":"template","templateId":"…"}` inspects its current or explicitly requested `templateVersion`.
4. `{"action":"render","view":{...},"templateId":"…","templateVersion":1}` validates fresh input and applies an exact saved version. Both template arguments are optional for ordinary rendering. Model access never modifies the library.

The catalog props, TypeScript types, validator and generated JSON Schema use the schemas in `src/protocol.ts`. Do not generate standalone or inline JSONL via `catalog.prompt()`. The runtime skill and checked-in SKILL.md derive from the same guidance source.

An envelope contains `protocolVersion`, `component`, `displayId`, `revision`, `summary`, and `payload`. Protocol 1.1 and 1.2 optionally carry a strict `presentation` object: version 1, bounded theme/layout, and exact template identity. A 1.0 checkpoint must not contain presentation. The host always snapshots the resolved theme for new deliveries; it never dereferences a mutable library during replay. Only ArchitectureExplorer, DecisionExplorer and DataChart are accepted. Runtime limits: conservative UTF-8 budget 131072 bytes, 12 levels, 80 nodes, 240 edges, 2000 chart rows, 10000 total histogram observations. Text and rule counts are separately bounded by the schema. URLs are not loaded; evidence is inert text. Unknown properties, callbacks, scripts, non-finite numbers, cyclic data and unsupported versions are rejected. There are no arbitrary actions or ECharts options.

`displayId` is supplied by the model: 1–80 ASCII letters, digits, `_ . : -`, starting with a letter or digit. Use a new ID for each distinct subject; identity is scoped to `(DSH session, turn, displayId)`. Updates to the same subject increase the positive integer `revision`. Replays and exact duplicate checkpoints do not create another node. Lower revisions retain the latest state. Same-revision conflicting content and component-type changes produce readable conflicts rather than silently changing meaning. The first checkpoint anchors the row; subsequent updates retain its identity. Cross-turn updates use a new identity by design.

Canonical output is a bounded status/summary receipt. DataChart additionally returns deterministic full-data `dataFacts` (endpoints, min/max, mean, valid/missing counts and adjacent valid decreases; histogram group totals, boundary/denominator rules, and bin details only up to 12 bins). Endpoint labels are truncated at 120 characters and explicitly flagged; raw rows are not echoed. Missing endpoint values keep net change unknown. These facts ground numeric prose without proving model statements or user-supplied facts. Only an explicitly requested `describe` returns a schema to the model. Delivered payloads are not duplicated in model output. `output.presentationMeta` projects a complete validated snapshot under `meta.dshSemanticUi`; DSH persists it in its standard `tool/result` or nested `tool/ptc-dispatch` event. Both paths are independently tested on the pinned release. There are no custom required session event types or calls to the upstream-only experimental plugin-record API. In nested PTC, a completed inner call can produce its UI even if later outer code fails; this is the same inner-call success boundary as ordinary effects, not an atomic outer-program transaction.

Errors carry stable `code`, `path`, `reason`, `hint`; at most 30 issues are returned per failure. Validation errors have a readable chat checkpoint; rendering exceptions fall back to the summary. Invalid data never falls through to a generic executable renderer. Schema-based validation does not prove model-supplied facts: users must still verify evidence.

## Architecture

IDs and references must exist and be unique. Scenario edge count equals node count minus one; each segment must use the declared edge and direction. Undirected edges permit either traversal. Self-loops, multiple edges and cycles are retained. Dagre computes a flat layout only; no nested-group promises. Search/locate and neighborhood filtering change the view, not the input facts. Hidden counts and restore-full actions are explicit. Relationships are also available as text.

## Decision rules

Options have exactly the common dimensions, with null for unknown facts. Inputs are finite numbers, booleans or enumerated choices, each allowing unknown. Conditions are a finite `all`/`any` list of up to 12 clauses using `eq/ne/gt/gte/lt/lte`; ordering operators require numeric inputs. There is no expression evaluator or recursion.

Highest matching priority wins. Equal-priority rules combine recommendations, preserving input option order. Active hard constraints exclude options. An unknown condition that could override a winner, or an unknown hard constraint on a recommended option, withholds the recommendation. No matching rule, all excluded options and insufficient conditions are distinct states. The UI labels the result as a rule evaluation and lists missing blocking conditions. Declared origin distinguishes given rules versus model-proposed judgments; origin is model-supplied and not independently verified. Focus dimensions only affect the table. Input changes list original and current values. No operation calls the model again.

Decision render receipts include `decisionFacts`: initial policy status, recommended option IDs, matched/pending rules, missing conditions, active/unknown constraints and declared-origin counts. These facts evaluate the submitted declarations; they do not certify user facts or rule origin. Prose must not turn an insufficient result into a winner. Local controls do not silently change the already delivered receipt or call the model.

## Numeric data

Line/category bar rows use one declared unit and explicit series values or null. No missing-to-zero replacement. Time x values need valid ISO timestamps with offsets, an IANA timezone, granularity and explicit sort strategy. Duplicate x values require upstream aggregation instead of accidental summation. Category bars are never described as histograms.

Histograms use raw observations or explicitly pre-aggregated counts and shared strictly increasing, equal-width bin boundaries. Unequal-width bins return `BIN_WIDTH`: the preview does not implement density semantics and must not draw unequal intervals at equal widths or invent rebinning from pre-aggregated counts. Bins are `[lower, upper)`, with the final upper bound included. Out-of-range observations are rejected. Proportion = bin count / selected valid observations in that group; zero denominator gives unknown. Missing observations are reported for the whole group because their bin is unknowable. Range changes select bins, preserving boundaries. The full source and derived selected bins are labeled separately.

Unweighted mean = sum of non-null observations / valid n. Empty/all-missing means are unknown. Overflow is reported as unknown, not infinity. Weighted averages, arbitrary ratios and quantiles are unsupported without a declared method; the schema rejects invented calculation requests. ECharts receives trusted configuration derived from these functions. Filtered metrics update deterministically; both the envelope summary and a supplied narrative are labeled as applying to the original full dataset.

## Protocol 1.2 requirements and preference review

Numeric comparison dimensions use kind=number, an explicit unit, and numeric or null option values. Requirements reference that dimension and a numeric local input in the identical unit; at-least / at-most comparisons recompute eligibility. Optional when clauses activate requirements; unknown activation or values preserve unknown feasibility. Eligibility does not establish a preferred choice.

Every newly delivered view uses current policy semantics. Historical 1.0/1.1 checkpoints remain readable with their prior behavior; unknown versions are rejected. All 1.2 preference rules await explicit local exploration, including model-declared given origins. Missing comparison cells still withhold preference. An origin string or omission of dimensions cannot authorize a winner. The local exploration checkbox resets on reload and does not feed back to the model. Graph facts, canonical summaries and current predicate traces are computed; original annotations remain unverified. See [semantics](SEMANTICS.zh-CN.md) and the [optional host-independent Codex bridge](CODEX.zh-CN.md).

## State

DSH owns content persistence. Local selection, dimensions and ranges reset on reload, reopening, or a new payload revision. No browser storage holds a second conversation copy. Personal templates/default themes use a separate owner-only, profile-scoped host storage domain. The host’s short receipt carries the resolved appearance, enabling presentationMeta to preserve the exact execution-time version even if the library later changes. See [template format and lifecycle](TEMPLATES.zh-CN.md) and [generated exchange schema](generated/template.schema.json). No state return to the model or cross-device preference sync is implemented. Generation uses the host's real pending state; semantic checkpoints are atomic. Unknown protocol versions and rendering errors remain readable.

## Protocol1.3 addition

`requires-availability` compares an option needing a boolean resource with a user input providing that resource. Option=false is inactive; option=true requires input=true, while unknown stays unknown. This is the opposite direction from `supports`, where the input declares a need and the option supplies the capability. Source labels do not prove the correct relation was selected. Protocol 1.2 snapshots retain their original meaning and reject this new relation.

`decisionFacts.inputEffects` reports declared hard/preference links; a preference-only control cannot change hard eligibility. The owner UI exposes the same distinction. This does not authenticate model prose, alter original snapshots or establish a new natural-model acceptance result.

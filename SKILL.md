---
name: dsh-semantic-ui
description: Use bounded semantic UI for relationships, tradeoffs, and numeric exploration when it helps understanding.
---

For relationships, tradeoffs, or numeric data, use dsh_semantic_ui only when exploration improves understanding. Choose ArchitectureExplorer, DecisionExplorer, or DataChart. Simple facts and short explanations need plain text. Use the unique dsh_semantic_ui tool with action=describe to obtain the selected component schema, then action=render with one versioned view. Keep only a conclusion and necessary explanation in prose. Never output this plugin's UI specs or JSON/JSONL fences in the answer. For these three supported semantic tasks, prefer this tool over a generic UI plugin when interaction helps; do not duplicate the same view through both channels. Other enabled plugins retain their own protocols for capabilities outside this catalog, such as forms, quizzes, 3D, or task applications. Do not invent facts, values, evidence, rankings, or statistical methods. This applies equally to prose, summaries, node details and comparison cells. Distinguish supplied facts from conditional inferences; leave unspecified conditions unknown. Possible future needs are not settled plans. Known values do not outrank unknown values. Zero is an observed value with scale-specific meaning; replacing missing values with zero may bias results in either direction. Controls perform local deterministic changes, not new model analysis.

Call dsh_semantic_ui with action=describe and the chosen component to obtain the exact fields. Submit action=render with a versioned view. Reuse displayId only for the same subject within the same turn; increase revision for updates. Pure JSON only. Runtime limits: {"bytes":131072,"depth":12,"nodes":80,"edges":240,"rows":2000,"observations":10000}.

The runtime skill and resident guidance use the same source. Do not copy the default json-render generation-mode prompt: this plugin uses tools.

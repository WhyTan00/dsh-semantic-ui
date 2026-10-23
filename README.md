# DSH Semantic UI

A personal, independently written **preview** plugin for native [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) conversations. It uses [json-render](https://github.com/vercel-labs/json-render) to render three bounded semantic components through one tool, `dsh_semantic_ui`.

- **ArchitectureExplorer** preserves declared relationships and offers scenario highlighting, search, neighborhood focus and an accessible relationship list.
- **DecisionExplorer** aligns common dimensions, preserves unknowns and explains finite conditional rules and hard constraints.
- **DataChart** supports lines, category bars and real histograms, with explicit missing values, units, bin rules, filters and source tables.

Plain text remains appropriate for simple questions. No model-generated JavaScript, JSX, HTML, callbacks, arbitrary ECharts options or network resources are accepted.

## Install

Requires Node 24+, pnpm, and DSH **0.2.1-rc.2**. Other versions, including 0.1.x, have not been certified. Download the versioned `.tgz` and `SHA256SUMS` from [Releases](https://github.com/WhyTan00/dsh-semantic-ui/releases), verify the checksum, then install into your chosen personal profile:

```sh
dsh plugin --profile web add /absolute/path/to/whytan-dsh-semantic-ui-0.1.0-preview.3.tgz
```

Reload the DSH page after installation. See [installation, isolation and rollback](docs/INSTALL.zh-CN.md). A normal personal model authorization is required for natural-question use; this plugin does not supply a model, copy credentials, or turn a Codex login into an API key.

## Delivery and persistence

The host validates a versioned semantic payload and projects the whole checkpoint through `output.presentationMeta`. The pinned DSH persists it in standard `tool/result` (Native) or `tool/ptc-dispatch` (nested PTC) events, separately from the short model receipt. The client uses `ConversationNodeDefinition` and the `conversation.chat.node` slot, with `groupTree: 'turn'`, to render outside folded tool steps. DSH's session log remains the only conversation store. Replaying checkpoints restores content; local controls reset after reload. No state is sent back to the model and no cross-device interaction sync is claimed.

The model sees a short receipt, not the full delivered spec. `action=describe` exposes the selected schema on demand. The same schemas supply the catalog, runtime types, validation and [generated protocol reference](docs/generated/protocol.schema.json).

DSH's shared React 18 hosts a small wrapper; a plugin-owned React 19 root runs json-render and the components inside a shadow root. This satisfies json-render's pinned React peer requirement without replacing DSH's React or styles.

## Evidence and limitations

This release distinguishes **real DSH with a deterministic fixture** from **real model acceptance**. See [validation results](docs/VALIDATION.zh-CN.md), [the frozen 11 questions](fixtures/questions.json) and [all natural-question round records](docs/natural-question-results.json). A fixture is not evidence of model expression choice. Three complete frozen 11-question rounds have now run through the existing personal WorkBuddy route (`deepseek-v4.1-flash`, high effort). Every first attempt and one excluded setup failure are retained. The latest round still has four content-semantic failures, so this remains a preview: valid structure and a rendered component do not establish factual correctness. See [per-question records](docs/natural-question-results.json).

[Public API/version evidence](docs/UPSTREAM.zh-CN.md) · [protocol and data semantics](docs/PROTOCOL.md) · [specific GenUI compatibility limits](docs/GENUI.zh-CN.md) · [中文说明](docs/OVERVIEW.zh-CN.md)

## Develop

```sh
pnpm install --frozen-lockfile
pnpm docs:generate
pnpm check
pnpm dev                  # component development preview only
pnpm test:host            # isolated real DSH + deterministic fixture
pnpm test:history         # real history prepend, all four fixtures, Native + PTC
pnpm test:compat          # installs public GenUI 0.14.0 in a fresh isolated profile
pnpm release:pack
```

Development preview is separate from DSH host verification. All examples are fictional. macOS and Linux instructions use the same Node-based commands; actual Linux CI status is recorded separately from local macOS checks.

## License

Original code: [MIT](LICENSE). Dependencies retain their own licenses, including Apache-2.0 for json-render and ECharts. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the retained files under `licenses/`.

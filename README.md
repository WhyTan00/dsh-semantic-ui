# DSH Semantic UI

A personal, independently written **preview** plugin for native [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) conversations. It uses [json-render](https://github.com/vercel-labs/json-render) to render three bounded semantic components through one tool, `dsh_semantic_ui`.

- **ArchitectureExplorer** preserves declared relationships and offers scenario highlighting, search, neighborhood focus and an accessible relationship list.
- **DecisionExplorer** aligns common dimensions, preserves unknowns and explains finite conditional rules and hard constraints.
- **DataChart** supports lines, category bars and real histograms, with explicit missing values, units, bin rules, filters and source tables.

Plain text remains appropriate for simple questions. No model-generated JavaScript, JSX, HTML, callbacks, arbitrary ECharts options or network resources are accepted.

The [interactive UI ecosystem study](docs/research/README.md) curates 35 public projects with immutable source pins, licenses, actual chart dependencies and adoption decisions. It replaces a blanket GenUI fallback with capability-based selection. Preview.5 adds a read-only `action=catalog`, initial-policy `decisionFacts`, and working ECharts ARIA descriptions. Future form submission and application state remain explicitly unimplemented; see the [adoption record](docs/research/ADOPTION.zh-CN.md).

The [GenUI absorption map](docs/research/GENUI-ABSORPTION.zh-CN.md) distinguishes researched patterns from implemented features. The [model-progress strategy](docs/research/MODEL-PROGRESS.zh-CN.md) proposes measurable workflow value and criteria for retiring redundant features. Their proposed integrations remain separate from delivered features.

Preview.6 adds **personal templates and bounded themes**: save a field contract and appearance, version/restore it, import/export it, and use it with new data in a new conversation. The model can discover and use exact versions; only the owner UI edits the library. Historical views retain concrete theme snapshots. Two fresh WorkBuddy conversations reused a saved template with new data; both kept the requested values and appearance, with one prose-attribution caveat. [Template guide](docs/TEMPLATES.zh-CN.md).

Preview.7 improves **visual and interaction fidelity**: elapsed-time axes, stable color/pattern identity, long-label bars, explicit all-missing states, scope-matched table downloads, keyboard graph inspection, distinct parallel/self edges, and responsive graph fitting. The [quality guide](docs/QUALITY.zh-CN.md) links each change to public sources and actual checks. No new rendering dependency was added.

Preview.8 adds **computed requirements and a portable verification core**: typed numeric/boolean conditions, graph intersections, unknown-aware eligibility, and preference policies held until explicit local exploration. A no-render `action=check` returns computed facts. New deliveries use protocol 1.2; saved 1.0/1.1 histories retain their behavior. See [semantic boundaries](docs/SEMANTICS.zh-CN.md).

**Codex already provides native interactive visualizations on supported surfaces.** The optional [Codex bridge](docs/CODEX.zh-CN.md) reuses our core through three read-only MCP tools and a portable skill; it does not duplicate the renderer. CLI/IDE can consume computed results but do not render native interactive visualizations. The bridge passed standalone JSON-RPC tests; it has not been globally installed or accepted in a live Codex model conversation.

Preview.9 uses **protocol1.3** to distinguish resource availability from capability support, expose hard/preference-only input links, and compute signed zero-fill comparisons explicitly. A fresh installed real DSH Native/PTC matrix covers the new predicates plus saved1.0/1.1/1.2 snapshot semantics.90 tests pass. No new natural-model requests were made: the original six semantic failures remain open. See [source mapping and limits](docs/GROUNDING-FOLLOWUP.zh-CN.md) and [versioned evidence](docs/evidence/preview9.json). Preview.8 archives, manifests, checksums and installation evidence remain unchanged.

## Install

Requires Node 24+, pnpm, and DSH **0.2.1-rc.2**. Other versions, including 0.1.x, have not been certified. Download the versioned `.tgz` and `SHA256SUMS` from [Releases](https://github.com/WhyTan00/dsh-semantic-ui/releases), verify the checksum, then install into your chosen personal profile:

```sh
dsh plugin --profile web add /absolute/path/to/whytan-dsh-semantic-ui-0.1.0-preview.9.tgz
```

Reload the DSH page after installation. See [installation, isolation and rollback](docs/INSTALL.zh-CN.md). A normal personal model authorization is required for natural-question use; this plugin does not supply a model, copy credentials, or turn a Codex login into an API key.

## Delivery and persistence

The host validates a versioned semantic payload and projects the whole checkpoint through `output.presentationMeta`. The pinned DSH persists it in standard `tool/result` (Native) or `tool/ptc-dispatch` (nested PTC) events, separately from the short model receipt. The client uses `ConversationNodeDefinition` and the `conversation.chat.node` slot, with `groupTree: 'turn'`, to render outside folded tool steps. DSH's session log remains the only conversation store. Replaying checkpoints restores content; local controls reset after reload. No state is sent back to the model and no cross-device interaction sync is claimed.

The model sees a bounded receipt, not the full delivered spec. DataChart additionally returns deterministic full-data `dataFacts` for checking numeric prose; DecisionExplorer returns `decisionFacts` evaluated under original declared conditions. Neither receipt certifies model-supplied facts or policy. `action=describe` exposes the selected schema on demand. The same schemas supply the catalog, runtime types, validation and [generated protocol reference](docs/generated/protocol.schema.json).

DSH's shared React 18 hosts a small wrapper; a plugin-owned React 19 root runs json-render and the components inside a shadow root. This satisfies json-render's pinned React peer requirement without replacing DSH's React or styles.

## Evidence and limitations

This release distinguishes **real DSH with deterministic fixtures** from **real model acceptance**. TypeScript, 90 tests, and a fresh installed Native/PTC lifecycle/quality/requirements/template matrix passed. Six complete frozen 11-question rounds (66 first attempts) are retained. New full rounds 5 and 6 scored 3 pass / 3 notes / 5 fail and 2 / 4 / 5. Final targeted run 9 repeated six selected original questions: **all six still fail content semantics**, including incorrect source-to-requirement mapping, extra prose claims, and GenUI/plain-text errors. It is not a complete seventh round or a controlled accuracy benchmark. Run 8 also preserves an actual integration failure and its repeated UI effects; setup-only attempts are separately identified.

See [validation](docs/VALIDATION.zh-CN.md), [frozen questions](fixtures/questions.json), and [all first-attempt records](docs/natural-question-results.json). This remains a preview: bounded computation can be correct while model-supplied premises or prose are wrong. Forms/feedback, arbitrary chart types, actual mobile-device and screen-reader acceptance remain open.

[Public API/version evidence](docs/UPSTREAM.zh-CN.md) · [protocol and data semantics](docs/PROTOCOL.md) · [specific GenUI compatibility limits](docs/GENUI.zh-CN.md) · [中文说明](docs/OVERVIEW.zh-CN.md)

Version preview.4 scopes its guidance to coexist with other UI protocols, labels decision results as declared rule evaluations, and supplies computed numeric receipts. Four real-model coexistence cases chose our three components and a GenUI form respectively; a real form submission returned to the model. Initial content errors and a separately retained numeric followup are documented in the [maturity assessment](docs/MATURITY.zh-CN.md). This is a specialized complement to GenUI, not a complete replacement.

The runtime `.tgz` contains compact evidence indexes. Full first attempts and screenshots remain open in the repository and a separate `dsh-semantic-ui-evidence` release archive. `SHA256SUMS` covers both archives; see [checksum instructions](docs/INSTALL.zh-CN.md#使用-release-包).

## Develop

```sh
pnpm install --frozen-lockfile
pnpm docs:generate
pnpm research:check       # pinned sources, licenses and derived inventory
pnpm check
pnpm dev                  # component development preview only
pnpm test:host            # isolated real DSH + deterministic fixture
pnpm test:history         # real history prepend, all four fixtures, Native + PTC
pnpm test:compat          # installs public GenUI 0.14.0 in a fresh isolated profile
pnpm release:pack         # writes artifacts/releases/<version>/
```

Development preview is separate from DSH host verification. All examples are fictional. macOS and Linux instructions use the same Node-based commands; actual Linux CI status is recorded separately from local macOS checks.

## License

Original code: [MIT](LICENSE). Dependencies retain their own licenses, including Apache-2.0 for json-render and ECharts. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the retained files under `licenses/`.

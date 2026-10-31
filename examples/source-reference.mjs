import {createHash} from 'node:crypto';

const sha = text => createHash('sha256').update(text).digest('hex');
const variants = [
  ['workflow-zh', 'parseWorkflowSource', 'checkSourceWorkflow'],
  ['permissions-zh', 'parsePermissionSource', 'checkSourcePermissions'],
  ['decision-zh', 'parseDecisionSource', 'checkSourceDecision'],
  ['capacity-zh', 'parseCapacitySource', 'checkSourceCapacity'],
  ['observations-zh', 'parseNumericSource', 'checkSourceNumeric'],
];

/** A finite source-data constructor, not a model correction or arbitrary NL interpreter. */
export function sourceReference(core, text, requestedKind) {
  const choices = variants.filter(([kind]) => !requestedKind || kind === requestedKind).map(([kind, parser, checker]) =>
    ({kind, checker, parsed: core[parser](text, 0)}));
  const ready = choices.filter(v => v.parsed.status === 'ready');
  if (ready.length !== 1) return {status: 'unsupported', reason: ready.length ? 'Ambiguous finite source grammar' : 'No complete supported finite source grammar',
    sourceSha256: sha(text), referenceAuthorship: 'program-derived reference, not a new model result', sourceFactsVerified: false};
  const {kind, checker, parsed: {value: source}} = ready[0];
  const snapshot = {kind, documentSha256: sha(text), textSha256: sha(text), excerptSha256: sha(text), jsonPointer: null,
    excerpt: text, textBytes: Buffer.byteLength(text), textByteStart: 0, textByteEnd: Buffer.byteLength(text)};
  const envelope = {protocolVersion: core.VERSION, displayId: 'source-reference-' + sha(text).slice(0, 16), revision: 1,
    summary: '有限来源的程序参考载荷；不是模型原文，不认证世界事实。'};
  let view, mapping;
  if (kind === 'workflow-zh' || kind === 'permissions-zh') {
    const ids = new Map(source.nodes.map((label, i) => [label, 'node-' + i]));
    const relations = kind === 'workflow-zh' ? source.relations : source.accesses;
    const edges = relations.map((r, i) => ({id: 'edge-' + i, source: ids.get(r.from), target: ids.get(r.to), directed: true,
      type: kind === 'workflow-zh' ? '声明流程' : r.mode, evidence: []}));
    view = {...envelope, component: 'ArchitectureExplorer', payload: {title: '来源声明的直接关系',
      nodes: source.nodes.map(label => ({id: ids.get(label), label, responsibility: '来源声明中的字面节点。', constraints: [], evidence: []})), edges,
      scenarios: edges.map((e, i) => ({id: 'relation-' + i, label: '声明关系 ' + (i + 1), nodeIds: [e.source, e.target], edgeIds: [e.id],
        explanation: '只高亮这条已声明的正向关系，不解释故障传播、业务独立或执行保证。'}))}};
    if (kind === 'workflow-zh') mapping = {failurePolicies: source.failurePolicies.map(p => ({trigger: ids.get(p.trigger),
      retryOnly: p.retryOnly.map(n => ids.get(n)), noRollback: p.noRollback.map(n => ids.get(n))}))};
  } else if (kind === 'capacity-zh') {
    view = {...envelope, component: 'DecisionExplorer', payload: {title: '来源声明的容量条件',
      dimensions: [{id: 'capacity', label: '容量上限', kind: 'number', unit: source.current.unit}],
      options: source.options.map((o, i) => ({id: 'option-' + i, label: o.label, values: {capacity: o.ceiling.value},
        advantages: [], disadvantages: [], suitableWhen: '只比较当前容量要求；部署和维护声明另见来源说明。', evidence: []})),
      inputs: [{id: 'demand', label: '需求容量', type: 'number', unit: source.current.unit, initial: source.current.value,
        expectedEffect: 'hard'}],
      requirements: [{id: 'capacity-demand', dimension: 'capacity', input: 'demand', relation: 'at-least'}],
      rules: [], constraints: []}};
    mapping = {capacityDimensionId: 'capacity', demandInputId: 'demand', requirementId: 'capacity-demand'};
  } else if (kind === 'decision-zh') {
    const coordinates = [...new Map(source.facts.filter(f => f.option !== null).map(f =>
      [[f.kind, f.name, f.actor].join('|'), {kind: f.kind, ...(f.name ? {name: f.name} : {}), ...(f.actor ? {actor: f.actor} : {})}])).values()];
    const dimensions = coordinates.map((f, i) => ({id: 'dimension-' + i,
      label: f.kind === 'capability' ? f.name : f.kind === 'actor-updates' ? '由' + f.actor + '更新' : f.kind === 'maintenance-need' ? '需要' + f.actor + '维护' : '价格',
      ...(f.kind === 'price' ? {} : {kind: 'boolean'}),
      ...(f.kind === 'capability' ? {semanticRole: 'capability-support'} : f.kind === 'maintenance-need' ? {semanticRole: 'resource-need'} : {})}));
    const inputs = [], inputCoordinates = [], requirements = [];
    coordinates.forEach((f, i) => {
      if (!['capability', 'maintenance-need'].includes(f.kind)) return;
      const capability = f.kind === 'capability', kind = capability ? 'capability-need' : 'actor-available';
      let index = inputCoordinates.findIndex(c => c.kind === kind && c.name === f.name && c.actor === f.actor);
      if (index < 0) {
        index = inputs.length;
        const fact = source.facts.find(x => x.kind === kind && (capability ? x.name === f.name : x.actor === f.actor));
        inputs.push({id: 'input-' + index, label: capability ? '当前需要' + f.name : f.actor + '有维护余力', type: 'boolean', initial: fact?.value ?? null,
          semanticRole: capability ? 'capability-need' : 'resource-available', expectedEffect: 'hard'});
        inputCoordinates.push({kind, ...(capability ? {name: f.name} : {actor: f.actor})});
      }
      requirements.push({id: 'requirement-' + i, dimension: dimensions[i].id, input: inputs[index].id,
        relation: capability ? 'supports' : 'requires-availability'});
    });
    view = {...envelope, component: 'DecisionExplorer', payload: {title: '来源声明的条件与取舍', dimensions,
      options: source.options.map((label, i) => ({id: 'option-' + i, label,
        values: Object.fromEntries(coordinates.map((f, n) => [dimensions[n].id,
          source.facts.find(x => x.option === label && x.kind === f.kind && (x.name ?? undefined) === f.name && (x.actor ?? undefined) === f.actor)?.value ?? null])),
        advantages: [], disadvantages: [], suitableWhen: '未给反面和价格保持未知；不形成整体推荐。', evidence: []})),
      inputs, requirements, constraints: [], rules: []}};
    mapping = {dimensions: coordinates.map((c, i) => ({id: dimensions[i].id, ...c})),
      inputs: inputCoordinates.map((c, i) => ({id: inputs[i].id, ...c}))};
  } else {
    const seriesId = 'source-values';
    view = {...envelope, component: 'DataChart', payload: {chartType: 'bar', title: '来源声明的' + source.measurement, unit: source.unit,
      x: {kind: 'category', order: 'input'}, series: [{id: seriesId, label: source.measurement}],
      rows: source.positions.map(p => ({id: 'position-' + p.index, x: String(p.index + 1), values: {[seriesId]: p.value}}))}};
    mapping = {seriesId, rows: source.positions.map(p => ({sourceIndex: p.index, rowId: 'position-' + p.index}))};
  }
  const checked = core.validateForDelivery(view);
  if (!checked.ok) return {status: 'refused', stage: 'new-delivery', issues: checked.issues};
  const request = {view: checked.value, ...(mapping ? {mapping} : {})};
  const comparison = core[checker](snapshot, request);
  if (comparison.comparison?.status !== 'matched') return {status: 'refused', stage: 'source-comparison', issues: comparison.issues, comparison};
  return {status: 'ready', kind, sourceSha256: sha(text), snapshot, parsedSource: source, request, comparison,
    definition: core.extractDefinition(checked.value), referenceAuthorship: 'program-derived finite source reference; not a repaired or new model answer',
    sourceFactsVerified: false, identityVerified: false, freeProseVerified: false};
}

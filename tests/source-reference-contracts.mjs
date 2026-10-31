import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../src/core.ts';
import {requirementChecks} from '../src/math.ts';
import {sourceReference} from '../examples/source-reference.mjs';
import {loadSourceReferences} from '../examples/original-source-cases.mjs';

const records = Object.fromEntries(['A2','A3','D1','D2','N2','T2'].map(id => [id, JSON.parse(readFileSync(`docs/evidence/natural/r9-${id}.json`))]));
const refs = Object.fromEntries(Object.entries(records).map(([id, record]) => [id, sourceReference(core, record.question)]));
const oldView = id => records[id].actualToolCalls.map(c => typeof c.arguments === 'string' ? JSON.parse(c.arguments) : c.arguments).filter(a => a?.view).at(-1).view;

test('five original complete sources produce checked references; the original prose-only case produces no invented UI', async () => {
  for (const id of ['A2','A3','D1','D2','N2']) {
    const reference = refs[id]; assert.equal(reference.status, 'ready'); assert.equal(reference.comparison.comparison.status, 'matched');
    assert.equal(reference.sourceFactsVerified, false); assert.equal(reference.freeProseVerified, false);
    assert.equal(core.validateForDelivery(reference.request.view).ok, true);
  }
  assert.equal(refs.T2.status, 'unsupported'); assert.equal(refs.T2.request, undefined);
  assert.equal(records.T2.actualToolCalls.length, 0);
  const selected = await loadSourceReferences(core, process.cwd(), {case:'D2'});
  const caller = await loadSourceReferences(core, process.cwd(), {sourceFile:'docs/evidence/natural/r9-D2.json',jsonPointer:'/question'});
  assert.equal(selected.fromOriginalCaseCatalog, true); assert.equal(caller.fromOriginalCaseCatalog, false);
  assert.deepEqual(caller.phases[0].reference.request, selected.phases[0].reference.request);
  assert.equal(caller.phases[0].origin.originalModelFinalSha256, null);
  await assert.rejects(loadSourceReferences(core, process.cwd(), {jsonPointer:'/question'}), /requires a source file/);
  await assert.rejects(loadSourceReferences(core, process.cwd(), {sourceFile:'docs/evidence/natural/r9-D2.json',case:'D2'}), /or an original case/);
});

test('actual original model views remain readable history and are not silently upgraded into approved source mappings', () => {
  for (const id of ['A2','A3','D1','D2']) assert.equal(core.validateEnvelope(oldView(id)).ok, true);
  assert.equal(core.checkSourceWorkflow(refs.A2.snapshot, {view: oldView('A2')}).comparison.status, 'mismatch');
  assert.equal(core.bindPermissionView(refs.A3.snapshot, oldView('A3')).ok, false);
  for (const id of ['D1','D2']) assert.equal(core.validateForDelivery(oldView(id)).ok, false);
  // Explicit reviewer coordinates test the original errors, not corrected model output.
  const decision = core.checkSourceDecision(refs.D1.snapshot, {view: oldView('D1'), mapping: {
    dimensions: [{id:'private_net',kind:'capability',name:'私网'},{id:'vendor_managed',kind:'actor-updates',actor:'供应商'},
      {id:'team_maint',kind:'maintenance-need',actor:'团队'},{id:'price',kind:'price'}],
    inputs: [{id:'need_private_net',kind:'capability-need',name:'私网'},{id:'team_capacity',kind:'actor-available',actor:'团队'}]}});
  assert(decision.issues.some(i => i.code === 'SOURCE_REQUIREMENT_ROLE'));
  assert.equal(decision.issues.filter(i => i.code === 'SOURCE_VALUE').length, 2);
  const capacity = core.checkSourceCapacity(refs.D2.snapshot, {view: oldView('D2'),
    mapping: {capacityDimensionId:'capacity',demandInputId:'demand',requirementId:'cap-cover'}});
  assert(capacity.issues.some(i => i.code === 'SOURCE_POLICY_UNSUPPORTED'));
});

test('original workflow exception and permission scope are preserved without inventing reverse edges or global exclusivity', () => {
  const workflow = refs.A2;
  assert.deepEqual(workflow.parsedSource.failurePolicies.map(p => ({trigger:p.trigger,retryOnly:p.retryOnly,noRollback:p.noRollback})),
    [{trigger:'通知',retryOnly:['通知'],noRollback:['支付']}]);
  const nodeLabel = id => workflow.request.view.payload.nodes.find(n => n.id === id).label;
  assert.deepEqual(workflow.request.mapping.failurePolicies.map(p => ({trigger:nodeLabel(p.trigger),retryOnly:p.retryOnly.map(nodeLabel),noRollback:p.noRollback.map(nodeLabel)})),
    [{trigger:'通知',retryOnly:['通知'],noRollback:['支付']}]);
  assert.equal(workflow.parsedSource.failurePolicies.some(p => p.trigger === '库存'), false);
  const permission = refs.A3.parsedSource;
  assert.deepEqual(permission.onlyTargets.map(p => ({from:p.from,targets:p.targets})), [{from:'客户端',targets:['Gateway']}]);
  assert.deepEqual(permission.prohibitions.map(p => [p.from,p.to]), [['Search','Store']]);
  assert.equal(permission.accesses.find(p => p.from==='Search' && p.to==='Index').mode, 'read-only');
  assert.equal(permission.accesses.find(p => p.from==='Account' && p.to==='Store').mode, 'read-write');
  assert.equal(permission.accesses.some(p => p.from==='Search' && p.to==='Gateway'), false);
  assert.equal(refs.A3.request.view.payload.nodes[0].label, '客户端');
});

test('D1 reference keeps unprovided opposite responsibilities unknown and uses burden versus availability', () => {
  const r = refs.D1, p = r.request.view.payload, mapping = r.request.mapping;
  const maintenance = mapping.dimensions.find(d => d.kind === 'maintenance-need').id;
  const updates = mapping.dimensions.find(d => d.kind === 'actor-updates').id;
  const available = mapping.inputs.find(i => i.kind === 'actor-available').id;
  assert.equal(p.options[0].values[maintenance], null); assert.equal(p.options[1].values[updates], null);
  assert.equal(p.inputs.find(i => i.id === available).initial, null);
  assert.equal(p.requirements.find(q => q.dimension === maintenance).relation, 'requires-availability');
  const price = p.dimensions.find(d => d.id === mapping.dimensions.find(x => x.kind === 'price').id);
  assert.equal(price.unit, undefined); assert.equal(price.kind, undefined);
  const values = Object.fromEntries(p.inputs.map(i => [i.id, i.initial]));
  const checks = requirementChecks(p, {...values, [available]: false});
  assert.equal(checks.find(c => c.optionId === p.options[1].id && c.requirementId === p.requirements.find(q => q.dimension === maintenance).id).status, 'fail');
  assert.equal(checks.find(c => c.optionId === p.options[0].id && c.requirementId === p.requirements.find(q => q.dimension === maintenance).id).status, 'unknown');
});

test('D2 reference uses one numeric hard demand and separates future possibility, deployment and maintenance', () => {
  const r = refs.D2, p = r.request.view.payload;
  assert.equal(p.inputs.length, 1); assert.equal(p.inputs[0].expectedEffect, 'hard'); assert.equal(p.inputs[0].initial, 80);
  assert.equal(r.parsedSource.possibleFuture.value, 300); assert.equal(r.parsedSource.confirmedFuturePlan, null);
  assert.equal(r.parsedSource.options[0].maintenance.value, null); assert.equal(r.parsedSource.options[1].deployment.value, null);
  assert.deepEqual(requirementChecks(p, {[p.inputs[0].id]:80}).map(c => c.status), ['pass','pass']);
  assert.deepEqual(requirementChecks(p, {[p.inputs[0].id]:300}).map(c => c.status), ['fail','pass']);
  assert.deepEqual(p.rules, []);
});

test('N2 original missing mask and denominator survive; zero-fill is same numeric mean and sum, not complete truth', () => {
  const r = refs.N2, p = r.request.view.payload, stats = r.comparison.sourceStatistics;
  assert.deepEqual(p.rows.map(row => row.values[p.series[0].id]), [-2,0,null,2]);
  assert.equal(stats.observed.mean, 0); assert.equal(stats.observed.sum, 0); assert.equal(stats.observed.denominator, 3);
  assert.equal(stats.complete.mean, null); assert.equal(stats.complete.sum, null); assert.equal(stats.complete.denominator, 4);
  const numeric = core.analyzeEnvelope(r.request.view).dataFacts.series[0];
  assert.equal(numeric.zeroFillIllustration.mean, 0); assert.equal(numeric.zeroFillIllustration.sum, 0);
  assert.equal(numeric.zeroFillIllustration.directionRelativeToObservedMean, 'same');
});

test('reference templates carry shape and roles, never old facts; a matching template does not approve changed source data', () => {
  for (const id of ['D1','D2','N2']) {
    const r = refs[id]; assert.equal(r.definition.options, undefined); assert.equal(r.definition.rows, undefined);
    assert(!r.definition.inputs?.some(i => Object.hasOwn(i,'initial')));
    assert.doesNotThrow(() => core.matchTemplate({definition:r.definition}, r.request.view));
  }
  assert.throws(() => core.matchTemplate({definition:core.extractDefinition(oldView('D1'))},refs.D1.request.view), /TEMPLATE_INPUT/);
  const changed = structuredClone(refs.N2.request.view); changed.payload.rows[0].values[changed.payload.series[0].id] = 10;
  assert.doesNotThrow(() => core.matchTemplate({definition:refs.N2.definition}, changed));
  assert.equal(core.checkSourceNumeric(refs.N2.snapshot,{...refs.N2.request,view:changed}).comparison.status,'mismatch');
});

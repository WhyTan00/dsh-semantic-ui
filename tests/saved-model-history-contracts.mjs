import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSavedHistory, selectMatchedCandidate, renderRequest, changes, jsonBytes, sha} from '../examples/saved-model-history.mjs';

test('selects the latest actual matched event for this source, independent of titles and IDs', () => {
  const item = (status, source, id) => ({tool: 'semantic_ui_source_check', status: 'completed',
    arguments: {view: {component: 'DecisionExplorer', displayId: id}, mapping: {}},
    result: {structuredContent: {comparison: {status}, source: {textSha256: source}}}});
  const phase = {sourceSha256: 'new-source', modelCompletedToolItems: [item('matched', 'old-source', 'unrelated'),
    item('matched', 'new-source', 'first'), item('mismatch', 'new-source', 'failed'), item('matched', 'new-source', 'latest')]};
  const picked = selectMatchedCandidate(phase);
  assert.equal(picked.index, 3); picked.item.arguments.view.displayId = 'changed-copy';
  assert.equal(phase.modelCompletedToolItems[3].arguments.view.displayId, 'latest');
  assert.throws(() => selectMatchedCandidate({...phase, sourceSha256: 'absent'}), /No actual matched/);
});

test('render adaptation preserves model view and mapping and only removes source-check claims', () => {
  const args = {view: {component: 'DecisionExplorer', payload: {inputs: [{initial: null}], options: [{values: {x: false}}]}},
    mapping: {inputs: [{id: 'x'}]}, claims: [{kind: 'condition', value: false}]};
  const original = structuredClone(args), render = renderRequest(args);
  assert.deepEqual(args, original); assert.deepEqual(render.view, args.view); assert.deepEqual(render.mapping, args.mapping);
  assert.equal(sha(jsonBytes(render.view)), sha(jsonBytes(args.view)));
  assert.deepEqual(new Set(changes(args, render).map(x => x.path)), new Set(['$.claims', '$.action']));
  assert.throws(() => renderRequest({...args, source: 'not a legal render authority'}), /Unsupported/);
});

test('public saved model evidence validates original bytes and is not a rebuilt expected view', async () => {
  const data = await loadSavedHistory(process.cwd());
  assert.equal(data.newModelStarts, 0); assert.equal(data.phases.length, 2);
  assert.equal(data.phases[0].origin.threadId, data.phases[1].origin.threadId);
  assert.notEqual(data.phases[0].origin.turnId, data.phases[1].origin.turnId);
  for (const phase of data.phases) {
    assert.deepEqual(phase.render.view, phase.originalArguments.view);
    assert.equal(phase.origin.selectedViewJsonSha256, phase.origin.renderViewJsonSha256);
    assert.equal(sha(phase.rawFinal), phase.origin.rawFinalSha256);
  }
});

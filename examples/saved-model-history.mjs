import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const sha = value => createHash('sha256').update(value).digest('hex');
export const jsonBytes = value => Buffer.from(JSON.stringify(value));

/** Select a real completed comparison, never rebuild a view from an expected answer. */
export function selectMatchedCandidate(phase) {
  const matches = phase.modelCompletedToolItems.map((item, index) => ({item, index})).filter(({item}) =>
    item.tool === 'semantic_ui_source_check' && item.status === 'completed' && item.arguments?.view && item.arguments?.mapping &&
    item.result?.structuredContent?.comparison?.status === 'matched' &&
    item.result.structuredContent.source?.textSha256 === phase.sourceSha256);
  assert(matches.length, 'No actual matched candidate for this source');
  return structuredClone(matches.at(-1));
}

export function renderRequest(arguments_) {
  assert(arguments_?.view?.component === 'DecisionExplorer' && arguments_.mapping, 'This example requires a mapped DecisionExplorer');
  assert(Object.keys(arguments_).every(key => ['view', 'mapping', 'claims'].includes(key)), 'Unsupported source-check argument');
  // Decision claims belong to source-check. Normal render rechecks view/mapping itself.
  return {action: 'render', view: structuredClone(arguments_.view), mapping: structuredClone(arguments_.mapping)};
}

export function changes(before, after, prefix = '$') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => changes(before[key], after[key], prefix + '.' + key));
  }
  return [{path: prefix, before: before === undefined ? {absent: true} : before, after: after === undefined ? {absent: true} : after}];
}

export async function loadSavedHistory(root) {
  const directory = path.join(root, 'docs/evidence');
  const indexBytes = await readFile(path.join(directory, 'source-history.json'));
  const index = JSON.parse(indexBytes);
  const phases = [];
  for (const record of index.phases) {
    const relative = `source-history/phase-${record.phase}.json`;
    const asset = index.assets.find(a => a.path === relative);
    const bytes = await readFile(path.join(directory, relative));
    assert(asset && asset.sha256 === sha(bytes) && asset.bytes === bytes.length, 'Saved evidence bytes differ from manifest');
    const phase = JSON.parse(bytes);
    assert.equal(phase.threadId, index.threadId);
    assert.equal(phase.turnId, record.turnId);
    assert.equal(sha(phase.source), phase.sourceSha256);
    const candidate = selectMatchedCandidate(phase);
    const raw = await readFile(path.join(directory, 'source-history', phase.candidateFile));
    assert.equal(sha(raw), phase.candidateSha256);
    const originalArguments = candidate.item.arguments;
    const render = renderRequest(originalArguments);
    assert.deepEqual(render.view, originalArguments.view);
    assert.deepEqual(render.mapping, originalArguments.mapping);
    phases.push({phase: record.phase, source: phase.source, sourceSha256: phase.sourceSha256,
      rawFinal: raw.toString('utf8'), originalArguments, render,
      origin: {threadId: phase.threadId, turnId: phase.turnId, phase: record.phase,
        evidenceFile: 'docs/evidence/' + relative, evidenceFileSha256: sha(bytes),
        modelToolItemIndex: candidate.index, modelToolName: candidate.item.tool,
        sourceSha256: phase.sourceSha256, rawFinalSha256: phase.candidateSha256,
        selectedArgumentsJsonSha256: sha(jsonBytes(originalArguments)),
        selectedViewJsonSha256: sha(jsonBytes(originalArguments.view)),
        serialization: 'UTF-8 JSON.stringify of the parsed original value; not original wire whitespace',
        renderViewJsonSha256: sha(jsonBytes(render.view)),
        renderAdapterChanges: changes(originalArguments, render)}});
  }
  assert.equal(phases.length, 2);
  return {runtimeVersion: index.runtimeVersion, runtimeArchiveSha256: index.archiveSha256,
    originEvidenceCommit: '2d303c877ec59bfa44fde77b5ab7fdef685a7ae0',
    originIndexSha256: sha(indexBytes), phases, newModelStarts: 0};
}

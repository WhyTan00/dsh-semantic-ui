import {chromium, expect} from '@playwright/test';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {checkpointOf} from '../src/dsh/definition';
import {changes} from './saved-model-history.mjs';
import {captureHostComponent} from './host-component-capture.mjs';

const dataset = JSON.parse(readFileSync(process.env.SOURCE_REFERENCE_DATASET, 'utf8'));
const output = process.env.HOST_OUTPUT, shared = process.env.HOST_SHARED, check = process.env.SAVED_REPLAY_CHECK === '1';
const auth = readFileSync(output + '/dsh-host.log', 'utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const browser = await chromium.launch(), page = await browser.newPage({viewport: {width: 1180, height: 3200}}), errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
const write = (name, value) => writeFileSync(output + '/' + name, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
const rpc = (method, request) => page.evaluate(async ({method, request}) => {
  const response = await fetch('/api/' + method, {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({type: 'client-request', rpcId: crypto.randomUUID(), method, payload: {args: {request}}})});
  const result = await response.json(); if (!result.result?.ok) throw Error('Owned reference RPC failed: ' + method); return result.result.value;
}, {method, request});
function* objects(value, depth = 0) {
  if (depth > 24 || value === null) return;
  if (typeof value === 'object') {yield value; for (const v of Object.values(value)) yield* objects(v, depth + 1);}
  else if (typeof value === 'string') try {yield* objects(JSON.parse(value), depth + 1);} catch {
    const a = value.indexOf('{'), b = value.lastIndexOf('}'); if (a >= 0 && b > a) try {yield* objects(JSON.parse(value.slice(a, b + 1)), depth + 1);} catch {}
  }
}
const events = value => [...new Map([...objects(value)].filter(v => typeof v.seq === 'number' && typeof v.type === 'string' && v.data !== undefined).map(v => [v.seq + ':' + v.type, v])).values()];
const frame = () => page.locator('[data-semantic-ui]').filter({has: page.locator('.source-explanation')});
const requestCount = () => readdirSync(shared + '/requests').length;
async function journal(sessionId, key) {
  const baseline = await rpc('session/projections', {sessionId}); assert.equal(baseline.kind, 'sequenced');
  const body = await rpc('session/page', {address: {kind: 'session', sessionId}, throughSeq: baseline.asOfSeq, maxMessages: 100, turnWindow: {minMessages: 1, minTurns: 1}});
  write('journal-' + key + '.json', {baseline, body}); return {asOfSeq: baseline.asOfSeq, events: events(body)};
}
function receipts(key, source) {
  return [...new Map(readdirSync(shared + '/requests').filter(f => f.startsWith(key + '-')).flatMap(f => {
    const req = JSON.parse(readFileSync(shared + '/requests/' + f));
    const at = req.messages.findLastIndex(m => m.role === 'user' && JSON.stringify(m.content).includes(source)); assert(at >= 0);
    return req.messages.slice(at + 1).filter(m => m.role === 'tool').flatMap(m => [...objects(m.content)]);
  }).map(v => [JSON.stringify(v), v])).values()];
}
try {
  await page.goto(auth); await page.waitForTimeout(300);
  if (await page.getByRole('button', {name: 'Continue', exact: true}).isVisible()) await page.getByRole('button', {name: 'Continue', exact: true}).click();
  const {workspace} = await rpc('workspace/create', {path: shared + '/documents'});
  const workspaceItem = page.getByRole('treeitem', {name: workspace.title, exact: true}); await workspaceItem.waitFor();
  if (await workspaceItem.getAttribute('aria-expanded') !== 'true') await workspaceItem.click();
  for (const phase of dataset.phases) {
    const {sessionId} = await rpc('session/create', {workspaceId: workspace.workspaceId});
    const title = '有限来源程序参考 ' + phase.caseKey + ' ' + Date.now();
    await rpc('session/rename', {sessionId, title}); await rpc('session/selectModel', {sessionId, provider: 'saved-model-replay', model: 'saved-model-replay'});
    const key = 'source-reference-' + phase.phase, sequence = [];
    if (phase.render) {
      sequence.push({action: 'source-check'});
      if (check && phase.legacyRender) sequence.push(phase.legacyRender);
      sequence.push({action: 'source-check', ...phase.reference.request}, phase.render);
    }
    writeFileSync(process.env.SAVED_REPLAY_PLAN, JSON.stringify({key, phase: phase.phase, kind: 'source-reference', source: phase.source,
      finalText: phase.finalText, argsSequence: sequence}), {mode: 0o600});
    const requestId = randomUUID(); write('prompt-intent-' + phase.caseKey + '.json', {sessionId, requestId, origin: phase.origin, source: phase.source});
    const acceptance = await rpc('session/prompt', {sessionId, requestId, mode: 'queue', content: [{type: 'text', text: phase.source}], clientTimeZone: 'UTC'});
    await page.getByRole('treeitem', {name: title, exact: false}).click(); await page.getByRole('banner').hover();
    await page.getByText('回放完成：' + key, {exact: false}).waitFor({timeout: 45000});
    await page.getByRole('button', {name: 'Stop generating', exact: true}).waitFor({state: 'hidden', timeout: 15000});
    const before = await journal(sessionId, phase.caseKey);
    const inputEvent = before.events.find(v => v.type === 'user/message' && v.data?.source?.rpcId === requestId);
    assert(inputEvent); assert.equal(inputEvent.data.source.kind, 'user'); assert.deepEqual(inputEvent.data.content, [{type: 'text', text: phase.source}]);
    const values = receipts(key, phase.source), legacyRejection = values.find(v => v.status === 'validation-failed' && v.deliveryId);
    if (check && phase.legacyRender) assert(legacyRejection, 'Actual old render must not silently be repaired/accepted');
    if (!phase.render) {
      await expect(frame()).toHaveCount(0); assert.equal(sequence.length, 0);
      results.push({caseKey: phase.caseKey, origin: phase.origin, sessionId, requestId, inputEvent, referenceStatus: phase.reference.status,
        component: null, sourceReferenceOnly: true, noForcedComponent: true, originalModelRawCertified: false}); continue;
    }
    await expect(frame()).toHaveCount(1); await expect(frame()).toBeVisible();
    const sourceCheck = values.find(v => v.sourceCheckKind && v.comparison?.status === 'not-requested');
    const matched = values.findLast(v => v.sourceCheckKind && v.comparison?.status === 'matched');
    const delivery = values.findLast(v => v.status === 'delivered' && v.sourceDeliveryStatus === 'bound'); assert(sourceCheck && matched && delivery);
    assert.equal(sourceCheck.source.textSha256, phase.sourceSha256); assert.equal(matched.source.textSha256, phase.sourceSha256);
    const checkpointEvent = before.events.find(v => checkpointOf(v)?.view?.displayId === phase.render.view.displayId);
    assert(checkpointEvent); const checkpoint = checkpointOf(checkpointEvent);
    assert.equal(checkpoint.sourceDelivery.sourceRef.textSha256, phase.sourceSha256);
    assert.equal(checkpoint.sourceDelivery.sourceRef.hostContext.messageId, inputEvent.data.id);
    const explanation = await frame().locator('.source-explanation p').first().innerText(); assert.equal(explanation, checkpoint.sourceDelivery.explanation);
    const count = requestCount(), local = [], payload = checkpoint.view.payload;
    if (check) {
      if (checkpoint.view.component === 'ArchitectureExplorer') {
        await expect(frame().locator('.react-flow__node')).toHaveCount(payload.nodes.length);
        const focus = payload.nodes.map(n => ({id: n.id, labels: new Set([n.id, ...payload.edges.filter(e => e.source === n.id || e.target === n.id).flatMap(e => [e.source, e.target])])})).find(n => n.labels.size < payload.nodes.length);
        if (focus) {
          await frame().getByRole('combobox', {name: '定位节点', exact: true}).selectOption(focus.id);
          await frame().getByRole('checkbox', {name: '仅显示相邻节点', exact: true}).check();
          await expect(frame().locator('.react-flow__node')).toHaveCount(focus.labels.size);
          local.push({kind: 'graph-neighborhood', fromNodes: payload.nodes.length, visibleNodes: focus.labels.size, graphSourceUnchanged: true});
        }
      } else if (checkpoint.view.component === 'DecisionExplorer') {
        const input = payload.inputs.find(v => v.type === 'number') ?? payload.inputs.find(v => v.semanticRole === 'resource-available') ?? payload.inputs[0];
        const previous = await frame().getByRole('region', {name: '需求检查明细', exact: true}).innerText();
        if (input.type === 'number') {
          const target = phase.reference.parsedSource.possibleFuture?.value ?? input.initial + 1;
          await frame().getByRole('spinbutton', {name: input.label, exact: true}).fill(String(target));
          local.push({kind: 'hard-demand', inputId: input.id, original: input.initial, hypothesis: target});
        } else {
          await frame().getByRole('combobox', {name: input.label, exact: true}).selectOption(input.initial === false ? 'true' : 'false');
          local.push({kind: 'resource-availability', inputId: input.id, original: input.initial, hypothesis: input.initial === false});
        }
        await expect.poll(() => frame().getByRole('region', {name: '需求检查明细', exact: true}).innerText()).not.toBe(previous);
        local.at(-1).requirementsBefore = previous; local.at(-1).requirementsAfter = await frame().getByRole('region', {name: '需求检查明细', exact: true}).innerText();
      } else {
        const previous = await frame().locator('.stats').innerText();
        await frame().getByRole('spinbutton', {name: '起始位置', exact: true}).fill('1');
        await expect.poll(() => frame().locator('.stats').innerText()).not.toBe(previous);
        local.push({kind: 'chart-range', from: 0, to: 1, statisticsBefore: previous, statisticsAfter: await frame().locator('.stats').innerText()});
      }
      const after = await journal(sessionId, phase.caseKey + '-local');
      assert.equal(after.asOfSeq, before.asOfSeq); assert.deepEqual(after.events, before.events); assert.equal(requestCount(), count);
      assert.equal(await frame().locator('.source-explanation p').first().innerText(), explanation);
      await page.reload(); await expect(frame()).toHaveCount(1); assert.equal(requestCount(), count);
      if (checkpoint.view.component === 'ArchitectureExplorer') {
        await expect(frame().locator('.react-flow__node')).toHaveCount(payload.nodes.length);
        await expect(frame().getByRole('combobox', {name: '定位节点', exact: true})).toHaveValue('');
      } else if (checkpoint.view.component === 'DecisionExplorer') for (const input of payload.inputs) {
        await expect(frame().getByRole(input.type === 'number' ? 'spinbutton' : 'combobox', {name: input.label, exact: true})).toHaveValue(input.initial === null ? 'unknown' : String(input.initial));
      } else await expect(frame().getByRole('spinbutton', {name: '起始位置', exact: true})).toHaveValue('0');
    }
    const images = [];
    if (check) for (const width of [640, 360]) {
      const file = 'source-reference-' + phase.caseKey + '-' + width + '.png';
      images.push({file, ...await captureHostComponent(frame(), width, output + '/evidence/' + file)});
    }
    results.push({caseKey: phase.caseKey, origin: phase.origin, sessionId, requestId, acceptance, inputEvent,
      referenceStatus: phase.reference.status, kind: phase.reference.kind, sourceReferenceOnly: true,
      referenceRequest: phase.reference.request, sourceCheck, matched, legacyRender: check ? phase.legacyRender : null,
      legacyRejection: legacyRejection ?? null, delivery, checkpointEvent, checkpoint,
      referenceToCheckpointChanges: changes(phase.render.view, checkpoint.view), localInteractions: local,
      journalAndSourceUnchanged: check, refreshRestoredOriginalState: check, images,
      sourceFactsVerified: false, identityVerified: false, freeProseVerified: false});
  }
  assert.deepEqual(errors, []);
  write('evidence/source-reference.json', {mode: 'native', originalInputs: dataset.fromOriginalCaseCatalog, results, pageErrors: errors,
    newModelStarts: 0, newModelAnswers: 0, sourceReferenceAuthorship: 'program, using the installed current core finite parsers',
    originalModelNaturalPassCountUnchanged: true, graphMainCodexClientVerified: false,
    sourceFactsVerified: false, identityVerified: false, freeProseVerified: false});
  console.log(JSON.stringify({mode: 'native', sourceCases: results.length, components: results.filter(v => v.checkpoint).length,
    legacyRejections: results.filter(v => v.legacyRejection).length, pageErrors: errors, newModelStarts: 0}));
} catch (error) {
  writeFileSync(output + '/failure.txt', await page.locator('body').ariaSnapshot(), {mode: 0o600}); throw error;
} finally {await browser.close();}

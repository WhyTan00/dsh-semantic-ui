import {chromium, expect} from '@playwright/test';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadSavedHistory, sha, jsonBytes, changes} from './saved-model-history.mjs';
import {checkpointOf} from '../src/dsh/definition';

const root = process.cwd(), saved = await loadSavedHistory(root), output = process.env.HOST_OUTPUT, shared = process.env.HOST_SHARED;
const check = process.env.SAVED_REPLAY_CHECK === '1';
const auth = readFileSync(output + '/dsh-host.log', 'utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
const browser = await chromium.launch(), page = await browser.newPage({viewport: {width: 1180, height: 3200}});
const errors = [], steps = []; page.on('pageerror', e => errors.push(e.message));
const write = (name, value) => writeFileSync(output + '/' + name, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
const rpc = (method, request) => page.evaluate(async ({method, request}) => {
  const r = await fetch('/api/' + method, {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({type: 'client-request', rpcId: crypto.randomUUID(), method, payload: {args: {request}}})});
  const j = await r.json(); if (!j.result?.ok) throw Error('Owned replay RPC failed ' + method + ': ' + JSON.stringify(j.result?.error)); return j.result.value;
}, {method, request});
function* objects(value, depth = 0) {
  if (depth > 24 || value === null) return;
  if (typeof value === 'object') {yield value; for (const x of Object.values(value)) yield* objects(x, depth + 1);}
  else if (typeof value === 'string') {
    try {yield* objects(JSON.parse(value), depth + 1);} catch {
      const a = value.indexOf('{'), b = value.lastIndexOf('}');
      if (a >= 0 && b > a) try {yield* objects(JSON.parse(value.slice(a, b + 1)), depth + 1);} catch {}
    }
  }
}
const events = journal => [...new Map([...objects(journal)].filter(v => typeof v.seq === 'number' && typeof v.type === 'string' && v.data !== undefined).map(v => [v.seq + ':' + v.type, v])).values()];
const frameList = () => page.locator('[data-semantic-ui]').filter({has: page.locator('.source-explanation')});
const requestCount = () => readdirSync(shared + '/requests').length;
let sessionId;
async function journal(label) {
  const baseline = await rpc('session/projections', {sessionId}); assert.equal(baseline.kind, 'sequenced');
  const body = await rpc('session/page', {address: {kind: 'session', sessionId}, throughSeq: baseline.asOfSeq,
    maxMessages: 100, turnWindow: {minMessages: 1, minTurns: 2}});
  write('journal-' + label + '.json', {baseline, body}); return {asOfSeq: baseline.asOfSeq, events: events(body)};
}
function capture(key, source) {
  const messages = readdirSync(shared + '/requests').filter(f => f.startsWith(key + '-')).flatMap(f => {
    const req = JSON.parse(readFileSync(shared + '/requests/' + f));
    assert(req.tools.some(t => t.function?.name === 'dsh_semantic_ui'), 'Native tool must be actually exposed');
    const at = req.messages.findLastIndex(m => m.role === 'user' && JSON.stringify(m.content).includes(source)); assert(at >= 0);
    return req.messages.slice(at + 1);
  });
  const receipts = [...new Map(messages.filter(m => m.role === 'tool').flatMap(m => [...objects(m.content)]).map(v => [JSON.stringify(v), v])).values()];
  const calls = [...objects(messages)].filter(v => v.function?.name === 'dsh_semantic_ui' && typeof v.function.arguments === 'string').map(v => JSON.parse(v.function.arguments));
  return {receipts, calls};
}
try {
  await page.goto(auth); await page.waitForTimeout(300);
  if (await page.getByRole('button', {name: 'Continue', exact: true}).isVisible()) await page.getByRole('button', {name: 'Continue', exact: true}).click();
  const {workspace} = await rpc('workspace/create', {path: shared + '/documents'});
  const workspaceItem = page.getByRole('treeitem', {name: workspace.title, exact: true}); await workspaceItem.waitFor();
  if (await workspaceItem.getAttribute('aria-expanded') !== 'true') await workspaceItem.click();
  ({sessionId} = await rpc('session/create', {workspaceId: workspace.workspaceId}));
  const title = '既有模型视图呈现回放（0新增模型） ' + Date.now(); await rpc('session/rename', {sessionId, title});
  await rpc('session/selectModel', {sessionId, provider: 'saved-model-replay', model: 'saved-model-replay'});
  let previous;
  for (const phase of saved.phases) {
    const key = 'saved-model-phase-' + phase.phase, sequence = [{action: 'source-check'}];
    if (previous) sequence.push({...previous.render, action: 'source-check'}, previous.render);
    sequence.push({action: 'source-check', ...phase.originalArguments}, phase.render);
    writeFileSync(process.env.SAVED_REPLAY_PLAN, JSON.stringify({key, phase: phase.phase, source: phase.source,
      rawFinal: phase.rawFinal, argsSequence: sequence}), {mode: 0o600});
    const requestId = randomUUID();
    write('prompt-intent-' + phase.phase + '.json', {requestId, origin: phase.origin, source: phase.source});
    const acceptance = await rpc('session/prompt', {sessionId, requestId, mode: 'queue', content: [{type: 'text', text: phase.source}], clientTimeZone: 'UTC'});
    write('prompt-accepted-' + phase.phase + '.json', acceptance);
    await page.getByRole('treeitem', {name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))}).click();
    await page.getByRole('banner').hover();
    await page.getByText('回放完成：' + key, {exact: false}).waitFor({timeout: 45000});
    await page.getByRole('button', {name: 'Stop generating', exact: true}).waitFor({state: 'hidden', timeout: 15000});
    await expect(frameList()).toHaveCount(phase.phase);
    const {receipts, calls} = capture(key, phase.source);
    const actualRender = calls.findLast(v => v.action === 'render' && v.view?.displayId === phase.originalArguments.view.displayId);
    assert.deepEqual(actualRender, phase.render); assert.deepEqual(actualRender.view, phase.originalArguments.view);
    const checks = receipts.filter(v => v.sourceCheckKind === 'decision-zh' && v.sourceDecision);
    const inspection = checks.find(v => v.comparison?.status === 'not-requested');
    const matched = checks.findLast(v => v.comparison?.status === 'matched');
    const delivery = receipts.findLast(v => v.status === 'delivered' && v.displayId === phase.render.view.displayId && v.sourceDeliveryStatus === 'bound');
    assert(inspection && matched && delivery); assert.equal(inspection.source.textSha256, phase.sourceSha256);
    assert.equal(matched.source.textSha256, phase.sourceSha256);
    const before = await journal('phase-' + phase.phase);
    const inputEvent = before.events.find(v => v.type === 'user/message' && v.data?.source?.rpcId === requestId);
    assert(inputEvent); assert.equal(inputEvent.data.source.kind, 'user');
    assert.deepEqual(inputEvent.data.content, [{type: 'text', text: phase.source}]);
    assert.equal(inputEvent.data.id, inspection.source.hostContext.messageId); assert.equal(inputEvent.seq, inspection.source.hostContext.messageSeq);
    const cpEvent = before.events.find(v => {const c = checkpointOf(v); return c?.view?.displayId === phase.render.view.displayId && c.sourceDelivery?.status === 'bound';});
    assert(cpEvent); const checkpoint = checkpointOf(cpEvent);
    assert.equal(checkpoint.sourceDelivery.sourceRef.textSha256, phase.sourceSha256);
    assert.equal(checkpoint.sourceDelivery.sourceRef.hostContext.messageId, inputEvent.data.id);
    assert.equal(checkpoint.turn, inspection.source.hostContext.turn);
    assert.deepEqual(checkpoint.view.payload.dimensions, phase.render.view.payload.dimensions);
    assert.deepEqual(checkpoint.view.payload.options.map(({id, label, values}) => ({id, label, values})), phase.render.view.payload.options.map(({id, label, values}) => ({id, label, values})));
    assert.deepEqual(checkpoint.view.payload.inputs, phase.render.view.payload.inputs);
    assert.deepEqual(checkpoint.view.payload.requirements, phase.render.view.payload.requirements);
    const frame = frameList().nth(phase.phase - 1), explanation = await frame.locator('.source-explanation p').first().innerText();
    assert.equal(explanation, checkpoint.sourceDelivery.explanation); assert.equal(explanation, delivery.canonicalExplanation);
    for (const input of phase.render.view.payload.inputs) await expect(frame.getByRole('combobox', {name: input.label, exact: true})).toHaveValue(input.initial === null ? 'unknown' : String(input.initial));
    const oldCheck = checks.find(v => v.comparison?.status === 'mismatch'), oldRender = receipts.find(v => v.status === 'validation-failed' && v.deliveryId);
    if (previous) {assert(oldCheck && oldRender); assert.equal(oldCheck.issues.filter(v => v.code === 'SOURCE_INITIAL').length, 2); assert.equal(oldRender.issues.filter(v => v.code === 'SOURCE_INITIAL').length, 2);}
    const local = [];
    if (check) {
      for (const input of phase.render.view.payload.inputs) {
        const count = requestCount(), oldText = await frame.getByRole('region', {name: '需求检查明细', exact: true}).innerText();
        const selected = input.initial === false ? 'true' : 'false';
        await frame.getByRole('combobox', {name: input.label, exact: true}).selectOption(selected);
        await expect.poll(() => frame.getByRole('region', {name: '需求检查明细', exact: true}).innerText()).not.toBe(oldText);
        const after = await journal('phase-' + phase.phase + '-local-' + input.id);
        assert.equal(after.asOfSeq, before.asOfSeq); assert.deepEqual(after.events, before.events); assert.equal(requestCount(), count);
        assert.equal(await frame.locator('.source-explanation p').first().innerText(), explanation);
        local.push({inputId: input.id, label: input.label, from: input.initial, selected,
          localRequirementTextBefore: oldText, localRequirementTextAfter: await frame.getByRole('region', {name: '需求检查明细', exact: true}).innerText(),
          meaningfulVisibleChange: true, sourceAndCheckpointJournalUnchanged: true, noTransportRequests: true});
        await page.reload(); await expect(frameList()).toHaveCount(phase.phase);
        for (const prior of saved.phases.slice(0, phase.phase)) for (const value of prior.render.view.payload.inputs)
          await expect(frameList().nth(prior.phase - 1).getByRole('combobox', {name: value.label, exact: true})).toHaveValue(value.initial === null ? 'unknown' : String(value.initial));
        assert.equal(requestCount(), count);
      }
    }
    steps.push({phase: phase.phase, origin: phase.origin, replayRequestId: requestId, promptAcceptance: acceptance,
      originalReplayInputEvent: inputEvent, originalModelArguments: phase.originalArguments, actualRenderRequest: actualRender,
      selectedViewJsonSha256: sha(jsonBytes(phase.originalArguments.view)), actualRenderViewJsonSha256: sha(jsonBytes(actualRender.view)),
      checkpointEvent: cpEvent, checkpoint, incomingViewToCheckpointChanges: changes(phase.originalArguments.view, checkpoint.view),
      sourceCheck: inspection, matched, delivery, oldCheck: oldCheck ?? null, oldRender: oldRender ?? null,
      visibleSourceExplanation: explanation, localInteractions: local, originalInitialsRestoredOnRefresh: check,
      sourceFactsVerified: false, identityVerified: false, freeProseVerified: false});
    previous = phase;
  }
  const final = await journal('final');
  for (const step of steps) {
    assert.deepEqual(final.events.find(v => v.seq === step.checkpointEvent.seq && v.type === step.checkpointEvent.type), step.checkpointEvent);
    assert.deepEqual(final.events.find(v => v.seq === step.originalReplayInputEvent.seq && v.type === step.originalReplayInputEvent.type), step.originalReplayInputEvent);
  }
  const images = [];
  if (check) for (const phase of saved.phases) for (const width of [640, 360]) {
    const element = frameList().nth(phase.phase - 1).locator('.semantic-root');
    await element.evaluate((el, width) => {el.style.width = width + 'px'; el.style.maxWidth = '100%';}, width);
    await expect.poll(() => element.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const geometry = await element.boundingBox(); assert(Math.abs(geometry.width - width) <= 1);
    const filename = `saved-model-${phase.phase}-${width}.png`; await element.screenshot({path: output + '/evidence/' + filename});
    images.push({file: filename, width, actualWidth: geometry.width, noRootOverflow: true});
  }
  assert.deepEqual(errors, []);
  write('evidence/saved-model-history.json', {mode: 'native', sessionId, sessionTitle: title, replayOfSavedRealModelResults: true,
    newRealModelStarts: 0, sameReplaySession: true, steps, images, oldInputAndCheckpointEventsUnchanged: true,
    pageErrors: errors, graphicalComponentsObserved: true, newOriginalModelRawProduced: false,
    liveCrossClientStreaming: false, mainCodexGraphicalUi: false, sourceFactsVerified: false, identityVerified: false, freeProseVerified: false});
  console.log(JSON.stringify({mode: 'native', phases: 2, localInteractions: steps.reduce((n, s) => n + s.localInteractions.length, 0), pageErrors: errors, newRealModelStarts: 0}));
} catch (error) {
  writeFileSync(output + '/failure.txt', await page.locator('body').ariaSnapshot(), {mode: 0o600}); throw error;
} finally {await browser.close();}

#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {loadSavedHistory, sha} from './saved-model-history.mjs';
import {startReplayServer} from './saved-model-replay-server.mjs';

const {values} = parseArgs({options: {archive: {type: 'string'}, manifest: {type: 'string'}, output: {type: 'string'},
  check: {type: 'boolean'}, open: {type: 'boolean'}, help: {type: 'boolean'}}});
if (values.help) {
  console.log('node examples/dsh-model-history.mjs --archive <local26.tgz> --manifest <manifest.json> [--open] [--check] [--output <new-private-dir>]\n默认启动临时Native DSH回放，Ctrl+C结束；--check自动交互验收并清理。始终0新增模型。');
  process.exit(0);
}
assert(values.archive && values.manifest, 'Provide the existing local archive and manifest; no automatic download');
const root = process.cwd(), archive = path.resolve(values.archive), manifest = JSON.parse(await readFile(values.manifest));
const saved = await loadSavedHistory(root);
assert.equal(path.basename(archive), manifest.filename);
assert.equal(sha(await readFile(archive)), manifest.sha256);
assert.equal(manifest.sha256, saved.runtimeArchiveSha256, 'Use the original accepted runtime for this replay');
const run = path.resolve(values.output ?? path.join(root, 'artifacts/local/model-view-replay-' + Date.now()));
await mkdir(run, {mode: 0o700}); // Never overwrite an existing run/profile.
const home = path.join(run, 'home'), profile = path.join(home, 'profiles/web'), output = path.join(run, 'native');
await mkdir(profile, {recursive: true, mode: 0o700});
await mkdir(path.join(output, 'evidence'), {recursive: true, mode: 0o700});
await mkdir(path.join(run, 'documents')); await mkdir(path.join(run, 'agents'));
const planFile = path.join(run, 'plan.json');
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, {DSH_HOME: home, DSH_AGENTS_HOME: path.join(run, 'agents'), DSH_SEMANTIC_REPLAY_KEY: 'local-replay-placeholder'});
const children = [];
let host, browser, replay, hostLog = '', port;
const write = (file, value) => writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
const signal = new Promise(resolve => {process.once('SIGINT', () => resolve('SIGINT')); process.once('SIGTERM', () => resolve('SIGTERM'));});
function child(kind, args, targetEnv = env) {
  const proc = spawn(process.execPath, args, {env: targetEnv, stdio: ['ignore', 'pipe', 'pipe']});
  children.push({kind, proc});
  return proc;
}
async function stop(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  proc.kill('SIGTERM');
  await Promise.race([new Promise(r => proc.once('exit', r)), delay(3000)]);
  if (proc.exitCode === null && proc.signalCode === null) {proc.kill('SIGKILL'); await new Promise(r => proc.once('exit', r));}
}
async function freePort() {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const number = server.address().port; await new Promise(r => server.close(r)); return number;
}
try {
  await write(path.join(profile, 'package.json'), {name: 'saved-model-replay-profile', private: true, dependencies: {},
    dsh: {profile: {bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']}}});
  await write(path.join(profile, 'cordis.yml'), '[]\n');
  const installer = child('installer', ['node_modules/@deepseek-ai/dsh/lib/bin.js', 'plugin', '--profile', 'web', 'add', archive]);
  let installationLog = ''; installer.stdout.on('data', b => installationLog += b); installer.stderr.on('data', b => installationLog += b);
  const installed = await new Promise(r => installer.once('exit', r));
  await write(path.join(run, 'install.log'), installationLog);
  assert.equal(installed, 0, 'Normal private dsh plugin add failed; inspect private install.log');
  const packageRoot = path.join(profile, 'node_modules/@whytan/dsh-semantic-ui');
  const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json')));
  assert.equal(pkg.version, saved.runtimeVersion);
  const entries = {};
  for (const [name, expected] of Object.entries(manifest.runtimeEntrypoints)) {
    entries[name] = sha(await readFile(path.join(packageRoot, name))); assert.equal(entries[name], expected);
  }
  await write(path.join(run, 'installation.json'), {method: 'normal dsh plugin add local tgz into a new private profile',
    version: pkg.version, archiveSha256: manifest.sha256, runtimeEntrypoints: entries,
    all388FilesRechecked: false, semanticSourceOverlay: false, downloadedArchive: false});
  replay = await startReplayServer(planFile, path.join(run, 'requests'));
  port = await freePort(); assert(port !== 3200 && replay.port !== 3200 && port !== replay.port);
  await write(path.join(run, 'ports.json'), {port, fixturePort: replay.port});
  await write(path.join(profile, 'cordis.patch.yml'), `- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(path.join(run, 'documents'))}\n- id: llm-pi-ai\n  config:\n    providers:\n      saved-model-replay:\n        api: openai-completions\n        apiKeyEnv: DSH_SEMANTIC_REPLAY_KEY\n        baseURL: http://127.0.0.1:${replay.port}/v1\n        models:\n          - id: saved-model-replay\n            name: Saved real model views - deterministic replay, no new model\n            contextWindow: 32768\n            maxTokens: 4096\n- id: tools\n  config:\n    mode: native\n`);
  host = child('native', ['node_modules/@deepseek-ai/dsh/lib/bin.js', '--profile', 'web', '--no-open', '--port', String(port)]);
  host.stdout.on('data', b => hostLog += b); host.stderr.on('data', b => hostLog += b);
  for (let i = 0; i < 300 && !/dsh web: http/.test(hostLog); i++) {
    assert(host.exitCode === null, 'Private host stopped before readiness; inspect private log'); await delay(100);
  }
  await write(path.join(output, 'dsh-host.log'), hostLog);
  const auth = hostLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0];
  assert(auth, 'Private host readiness URL missing');
  await write(path.join(run, 'OPEN-PRIVATE.txt'), auth + '\n');
  browser = child('browser-seed', ['--import', 'tsx', 'examples/dsh-model-history-browser.mjs'], {...env,
    HOST_ORIGIN: `http://127.0.0.1:${port}`, HOST_SHARED: run, HOST_OUTPUT: output,
    SAVED_REPLAY_PLAN: planFile, SAVED_REPLAY_CHECK: values.check ? '1' : '0'});
  let browserLog = ''; browser.stdout.on('data', b => browserLog += b); browser.stderr.on('data', b => browserLog += b);
  const result = await new Promise(r => browser.once('exit', r));
  await write(path.join(run, 'browser.log'), browserLog);
  assert.equal(result, 0, 'Saved-view replay browser failed; inspect private browser.log');
  await write(path.join(run, 'run.json'), {mode: 'native', replayOfSavedRealModelResults: true,
    existingRuntime: saved.runtimeVersion, originEvidenceCommit: saved.originEvidenceCommit,
    newRealModelStarts: 0, localTransportRequests: replay.requestCount(), checked: !!values.check,
    publicProvenance: saved.phases.map(x => x.origin)});
  if (values.check) console.log(JSON.stringify({mode: 'native', checked: true, newRealModelStarts: 0,
    localTransportRequests: replay.requestCount(), privateOutput: run}));
  else {
    console.log('已保存模型结果的DSH Native回放已就绪（0新增模型）。私有访问地址保存在 ' + path.join(run, 'OPEN-PRIVATE.txt') + '；Ctrl+C关闭本次自有服务。');
    if (values.open) {
      assert.equal(process.platform, 'darwin', '--open currently uses macOS Edge; otherwise open the private URL yourself');
      const opener = spawn('open', ['-a', 'Microsoft Edge', auth], {stdio: 'ignore'});
      assert.equal(await new Promise(r => opener.once('exit', r)), 0, 'Could not open Edge');
    }
    await signal;
  }
} finally {
  await stop(browser); await stop(host);
  if (replay) {replay.server.closeAllConnections(); await new Promise(r => replay.server.close(r));}
  await write(path.join(output, 'dsh-host.log'), hostLog);
  await write(path.join(run, 'cleanup.json'), {processes: children.map(({kind, proc}) => ({kind, pid: proc.pid, exitCode: proc.exitCode, signalCode: proc.signalCode})),
    port: port ?? null, fixturePort: replay?.port ?? null, localTransportRequests: replay?.requestCount() ?? 0,
    newRealModelStarts: 0, replayServerClosed: !replay || !replay.server.listening});
}

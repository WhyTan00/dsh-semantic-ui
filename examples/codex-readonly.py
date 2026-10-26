#!/usr/bin/env python3
"""Explicit Codex app-server MCP client. No turn, model call or persistent install.

Python 3.12+, Node 24+, Codex CLI 0.164.0. A compatible app-server is required.
The supplied manifest authenticates bytes only, not its author or source facts.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import queue
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import tomllib
import uuid

ALLOWED = {
    'initialize', 'thread/start', 'thread/unsubscribe', 'mcpServerStatus/list',
    'mcpServer/tool/call', 'skills/extraRoots/set', 'skills/list', 'fs/readFile',
}
TAP = r'''import{spawn}from'node:child_process';import{readFileSync,writeSync,openSync}from'node:fs';import{createHash}from'node:crypto';import{StringDecoder}from'node:string_decoder';
const config=JSON.parse(readFileSync(process.argv[2],'utf8')),fd=openSync(config.log,'a',0o600);let seq=0;const log=(direction,value)=>writeSync(fd,JSON.stringify({observerPid:process.pid,seq:++seq,at:new Date().toISOString(),direction,value})+'\n');
if(createHash('sha256').update(readFileSync(config.entry)).digest('hex')!==config.entrySha256)throw Error('Archive entry changed');
const child=spawn(process.execPath,[config.entry,...config.args],{cwd:config.cwd,env:{PATH:process.env.PATH,LANG:process.env.LANG??'en_US.UTF-8'},stdio:['pipe','pipe','pipe']});log('process',{pid:child.pid,entrySha256:config.entrySha256});
function capture(direction){const decoder=new StringDecoder('utf8');let pending='';return b=>{pending+=decoder.write(b);let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);if(line)try{log(direction,JSON.parse(line));}catch{log(direction,{unparsedLine:line});}}};}
const request=capture('request'),response=capture('response');process.stdin.on('data',b=>{request(b);child.stdin.write(b);});process.stdin.on('end',()=>child.stdin.end());child.stdout.on('data',b=>{response(b);process.stdout.write(b);});child.stderr.on('data',b=>{log('stderr',b.toString());process.stderr.write(b);});child.on('error',e=>{log('spawnError',e.message);process.exitCode=1;});child.on('exit',(code,signal)=>{log('exit',{code,signal});process.exitCode=code??1;process.stdin.destroy();});for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>child.kill(s));
'''

def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    path.chmod(0o600)


class RpcError(Exception):
    def __init__(self, method, error):
        self.method, self.error = method, error
        super().__init__(f'{method}: {error}')


class CodexRpc:
    def __init__(self, argv, logs):
        self.log = (logs / 'codex-wire.jsonl').open('x', encoding='utf-8')
        self.stderr = (logs / 'codex.stderr').open('x', encoding='utf-8')
        (logs / 'codex-wire.jsonl').chmod(0o600)
        (logs / 'codex.stderr').chmod(0o600)
        self.proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=self.stderr, text=True, bufsize=1,
                                     start_new_session=True)
        self.messages = queue.Queue()
        self.sequence = 0
        self.sent_methods = []
        self.lock = threading.Lock()
        self.write_lock = threading.Lock()
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def record(self, direction, value):
        with self.lock:
            self.log.write(json.dumps({'at': time.time(), 'direction': direction,
                                       'value': value}, ensure_ascii=False) + '\n')
            self.log.flush()

    def _send(self, message):
        self.record('request', message)
        with self.write_lock:
            self.proc.stdin.write(json.dumps(message, ensure_ascii=False) + '\n')
            self.proc.stdin.flush()

    def _read(self):
        for line in self.proc.stdout:
            try:
                message = json.loads(line)
            except ValueError:
                self.record('unparsed', line)
                continue
            self.record('response', message)
            if 'method' in message and 'id' in message:
                # The read-only client never grants approvals, auth or elicitation.
                self._send({'id': message['id'], 'error': {
                    'code': -32601, 'message': 'This client handles no server requests'}})
            else:
                self.messages.put(message)
        self.messages.put(None)

    def call(self, method, params):
        if method not in ALLOWED:
            raise ValueError('Method outside the no-inference allowlist')
        if method == 'thread/start' and params.get('ephemeral') is not True:
            raise ValueError('Only ephemeral threads are allowed')
        self.sequence += 1
        request_id = self.sequence
        self.sent_methods.append(method)
        self._send({'id': request_id, 'method': method, 'params': params})
        deadline = time.monotonic() + 60
        while True:
            remaining = deadline-time.monotonic()
            if remaining <= 0:
                raise TimeoutError('RPC response missing; reconcile the saved request before retrying')
            message = self.messages.get(timeout=remaining)
            if message is None:
                raise RuntimeError('Codex exited before the RPC response')
            if message.get('id') == request_id:
                if 'error' in message:
                    raise RpcError(method, message['error'])
                return message['result']

    def initialized(self):
        self._send({'method': 'initialized'})

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(self.proc.pid, signal.SIGTERM)
                try:
                    self.proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(self.proc.pid, signal.SIGKILL)
                    self.proc.wait()
        self.reader.join(timeout=1)
        self.log.close()
        self.stderr.close()
        return self.proc.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--source-file', type=Path, required=True)
    parser.add_argument('--source-json-pointer')
    parser.add_argument('--source-kind', choices=['arrows','decision-zh','permissions-zh'],
                        default='decision-zh')
    parser.add_argument('--component', choices=['ArchitectureExplorer','DecisionExplorer','DataChart'],
                        default='DecisionExplorer')
    parser.add_argument('--requests-file', type=Path,
                        help='Optional JSON array of existing source-check requests; default [{}]')
    parser.add_argument('--log-dir', type=Path,
                        help='New private directory for complete Codex/MCP protocol logs')
    parser.add_argument('--codex', default='codex')
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    archive = args.archive.resolve()
    if archive.name != manifest['filename'] or sha(archive.read_bytes()) != manifest['sha256']:
        raise ValueError('Archive differs from the supplied manifest')
    requests = json.loads(args.requests_file.read_text()) if args.requests_file else [{}]
    if not isinstance(requests, list) or not 1 <= len(requests) <= 16 or any(
            not isinstance(value, dict) for value in requests):
        raise ValueError('Supply one to sixteen JSON object requests')
    logs = args.log_dir.resolve() if args.log_dir else Path(tempfile.mkdtemp(prefix='semantic-route-logs-'))
    if args.log_dir:
        logs.mkdir(mode=0o700, parents=True, exist_ok=False)
    logs.chmod(0o700)
    root = Path(tempfile.mkdtemp(prefix='semantic-codex-route-'))
    root.chmod(0o700)
    config_path = Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex'))) / 'config.toml'
    config_bytes = config_path.read_bytes() if config_path.exists() else b''
    config = tomllib.loads(config_bytes.decode())
    node = shutil.which(args.node)
    codex = shutil.which(args.codex)
    if not node or not codex:
        raise RuntimeError('Node and Codex must be installed')
    rpc = None
    thread_id = None
    output = {}
    try:
        with tarfile.open(archive) as packed:
            packed.extractall(root, filter='data')
        package = root/'package'
        entry = package/'dist/mcp.js'
        entry_sha = sha(entry.read_bytes())
        if entry_sha != manifest['runtimeEntrypoints']['dist/mcp.js']:
            raise ValueError('Archived MCP entry differs from manifest')
        skill = package/'skills/semantic-ui-checks/SKILL.md'
        skill_bytes = skill.read_bytes()
        workspace = root/'workspace'
        workspace.mkdir()
        source_args = ['--source-file',str(args.source_file.resolve()),
                       '--source-kind',args.source_kind]
        if args.source_json_pointer is not None:
            source_args += ['--source-json-pointer',args.source_json_pointer]
        tap = logs/'stdio-tap.mjs'
        tap.write_text(TAP)
        tap_config = logs/'tap-config.json'
        write_json(tap_config, {'entry':str(entry),'entrySha256':entry_sha,
                    'args':source_args,'cwd':str(workspace),'log':str(logs/'mcp-wire.jsonl')})
        server = 'semantic_explicit_' + uuid.uuid4().hex[:10]
        argv = [codex,'--no-daemon','-C',str(workspace)]
        def override(name, value):
            argv.extend(['-c',name+'='+json.dumps(value,ensure_ascii=False,separators=(',',':'))])
        # Only MCP names are used for isolation; credential values are not forwarded.
        for name in config.get('mcp_servers', {}):
            if '.' in name:
                raise ValueError('Dotted inherited MCP server name needs explicit isolation review')
            override('mcp_servers.'+name+'.enabled',False)
        for feature in ['apps','plugins','remote_plugin','shell_tool','browser_use',
                        'computer_use','memories','goals','hooks','multi_agent']:
            override('features.'+feature,False)
        override('features.skip_host_skill_discovery',True)
        override('project_doc_max_bytes',0)
        override('web_search','disabled')
        override('apps._default.enabled',False)
        prefix = 'mcp_servers.'+server+'.'
        for key,value in [('command',node),('args',[str(tap),str(tap_config)]),
                          ('cwd',str(workspace)),('enabled',True),('required',True),
                          ('enabled_tools',['semantic_ui_schema','semantic_ui_source_check']),
                          ('default_tools_approval_mode','auto')]:
            override(prefix+key,value)
        argv += ['app-server','--stdio']
        write_json(logs/'invocation.json',{'argv':argv,'archiveSha256':manifest['sha256'],
                    'mcpEntrySha256':entry_sha,'sourceCommit':manifest['sourceCommit'],
                    'defaultModel':config.get('model'),'defaultReasoning':config.get('model_reasoning_effort')})
        rpc = CodexRpc(argv,logs)
        rpc.call('initialize',{'clientInfo':{'name':'semantic_ui_explicit_reader',
                 'title':'Semantic UI explicit read-only client','version':'1.0.0'},
                 'capabilities':{'experimentalApi':True}})
        rpc.initialized()
        started = rpc.call('thread/start',{'cwd':str(workspace),'ephemeral':True,
                     'allowProviderModelFallback':False})
        thread_id = started['thread']['id']
        inventory = rpc.call('mcpServerStatus/list',{'threadId':thread_id,
                                    'detail':'toolsAndAuthOnly','limit':100})
        active = [r for r in inventory['data'] if r.get('runtimeStatus') != 'disabled']
        disabled = [r for r in inventory['data'] if r['name'] != server]
        if inventory.get('nextCursor') or [r['name'] for r in active] != [server] or any(
                r.get('runtimeStatus') != 'disabled' or r['tools'] or r['resources']
                for r in disabled):
            raise RuntimeError('An inherited server was active or the semantic server was missing')
        selected = rpc.call('mcpServerStatus/list',{'threadId':thread_id,
                            'serverName':server,'detail':'toolsAndAuthOnly','limit':100})
        if len(selected['data']) != 1 or selected['data'][0]['name'] != server:
            raise RuntimeError('Thread-scoped server selection failed')
        tools = selected['data'][0]['tools']
        if {v['name'] for v in tools.values()} != {'semantic_ui_schema','semantic_ui_source_check'}:
            raise RuntimeError('Unexpected thread tool catalog')
        def tool(name, arguments):
            return rpc.call('mcpServer/tool/call',{'threadId':thread_id,'server':server,
                                                'tool':name,'arguments':arguments})
        schema = tool('semantic_ui_schema',{'component':args.component})
        checks = []
        for request in requests:
            try:
                checks.append({'request':request,'response':tool('semantic_ui_source_check',request)})
            except RpcError as error:
                checks.append({'request':request,'rpcError':error.error})
        before = rpc.call('skills/list',{'cwds':[str(workspace)],'forceReload':True})
        rpc.call('skills/extraRoots/set',{'extraRoots':[str(package/'skills')]})
        discovered = rpc.call('skills/list',{'cwds':[str(workspace)],'forceReload':True})
        matches = [s for d in discovered['data'] for s in d['skills']
                   if Path(s['path']).resolve() == skill.resolve()]
        if len(matches) != 1 or not matches[0]['enabled']:
            raise RuntimeError('The archived portable skill was not discoverable')
        read = rpc.call('fs/readFile',{'path':str(skill)})
        read_bytes = base64.b64decode(read['dataBase64'],validate=True)
        if read_bytes != skill_bytes:
            raise RuntimeError('Codex skill file bytes differ from the archive')
        rpc.call('skills/extraRoots/set',{'extraRoots':[]})
        after = rpc.call('skills/list',{'cwds':[str(workspace)],'forceReload':True})
        target_in = lambda result: any(Path(s['path']).resolve() == skill.resolve()
                                     for d in result['data'] for s in d['skills'])
        if target_in(before) or target_in(after):
            raise RuntimeError('Temporary skill discovery did not remain scoped to the extra root')
        output = {'mode':'explicit client calls, not model-selected tools','threadId':thread_id,
                  'model':started['model'],'reasoningEffort':started['reasoningEffort'],
                  'server':server,'disabledOtherServerCount':len(disabled),'toolCatalog':[v['name'] for v in tools.values()],
                  'archiveSha256':manifest['sha256'],'mcpEntrySha256':entry_sha,
                  'schema':schema,'sourceChecks':checks,
                  'skill':{'name':matches[0]['name'],'scope':matches[0]['scope'],
                           'sha256':sha(read_bytes),'discoveredAndRead':True,
                           'absentBeforeAndAfterTemporaryRoot':True},
                  'newModelTurns':0,'privateLogs':str(logs)}
        write_json(logs/'result.json',output)
    finally:
        if rpc:
            if thread_id:
                try:
                    rpc.call('skills/extraRoots/set',{'extraRoots':[]})
                    rpc.call('thread/unsubscribe',{'threadId':thread_id})
                except Exception as error:
                    write_json(logs/'cleanup-error.json',{'error':str(error)})
            code = rpc.close()
            write_json(logs/'terminal.json',{'appServerPid':rpc.proc.pid,'exitCode':code,
                    'sentMethods':rpc.sent_methods,'newModelTurns':0,
                    'globalConfigShaUnchanged':sha(config_path.read_bytes() if config_path.exists() else b'')==sha(config_bytes)})
        shutil.rmtree(root)
    print(json.dumps(output,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()

import{build}from'esbuild';
import{spawn,execFileSync}from'node:child_process';
import{createServer}from'node:net';
import{mkdir,writeFile,readFile}from'node:fs/promises';
import{resolve,basename,join}from'node:path';
import{createHash}from'node:crypto';
import{setTimeout as delay}from'node:timers/promises';
const root=process.cwd(),run=resolve('artifacts/local/host-'+Date.now());await mkdir(run,{recursive:true,mode:0o700});
const freePort=()=>new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const fixturePort=await freePort(),port=await freePort();if(port===3200||fixturePort===3200||port===fixturePort)throw Error('Distinct task-owned ports required');
const home=join(run,'home'),profile=join(home,'profiles/web'),documents=join(run,'documents');await mkdir(profile,{recursive:true});await mkdir(documents,{recursive:true});await mkdir(join(run,'agents'),{recursive:true});
await writeFile(join(profile,'package.json'),JSON.stringify({name:'semantic-cold-fixture-profile',private:true,dependencies:{},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}}));await writeFile(join(profile,'cordis.yml'),'[]\n');await writeFile(join(run,'ports.json'),JSON.stringify({port,fixturePort}));
const coldFixture=join(run,'cold-fixture.mjs');await build({entryPoints:['tests/fixtures/cold-source-plugin.ts'],outfile:coldFixture,bundle:true,platform:'node',format:'esm',packages:'external'});
const overlay=join(run,'plugin.patch.yml');await writeFile(overlay,`- insert:\n    - id: semantic-cold-source-fixture\n      name: ${JSON.stringify(coldFixture)}\n${process.env.INSTALL_PACKAGE?'':`- insert:\n    - id: dsh-semantic-ui\n      name: ${JSON.stringify(join(root,'dist/host.js'))}\n`}`);
const env={...process.env,DSH_HOME:home,DSH_AGENTS_HOME:join(run,'agents'),DSH_SEMANTIC_FIXTURE_KEY:'local-fixture-placeholder',FIXTURE_PORT:String(fixturePort),FIXTURE_OUTPUT_DIR:join(run,'requests'),FIXTURE_DELAY_MS:'1200',SOURCE_HOST_CASE_FILE:join(run,'source-case.json')};await writeFile(env.SOURCE_HOST_CASE_FILE,JSON.stringify({key:'cold-initial',args:{action:'source-check'}}));
let filesVerified=0;
if(process.env.INSTALL_PACKAGE){
 const installer=spawn(process.execPath,['node_modules/@deepseek-ai/dsh/lib/bin.js','plugin','--profile','web','add',resolve(process.env.INSTALL_PACKAGE)],{env,stdio:['ignore','pipe','pipe']});let log='';installer.stdout.on('data',b=>log+=b);installer.stderr.on('data',b=>log+=b);const code=await new Promise(r=>installer.once('exit',r));await writeFile(join(run,'install.log'),log);if(code!==0)throw Error('Cold candidate installation failed; see private log');
 const expected=join(run,'installed-archive');await mkdir(expected,{recursive:true});execFileSync('tar',['-xzf',resolve(process.env.INSTALL_PACKAGE),'-C',expected]);const files=execFileSync('tar',['-tzf',resolve(process.env.INSTALL_PACKAGE)],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.endsWith('/'));
 for(const file of files){const relative=file.replace(/^package\//,'');if(!(await readFile(join(profile,'node_modules/@whytan/dsh-semantic-ui',relative))).equals(await readFile(join(expected,file))))throw Error('Installed file mismatch: '+relative);}filesVerified=files.length;
 await writeFile(join(run,'installed-byte-check.json'),JSON.stringify({allFilesVerified:filesVerified,verifiedBeforeStartingHost:true},null,2)+'\n');
}
const children=[],logs=[];const launch=(kind,args,childEnv=env)=>{const child=spawn(process.execPath,args,{env:childEnv,stdio:['ignore','pipe','pipe']});children.push({kind,child});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);const item={kind,child,get log(){return log;}};logs.push(item);return item;};
async function stop(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));}}
const fixture=launch('fixture',['--import','tsx','tests/fixtures/llm-server.ts']);let activeHost;
try{
 for(const mode of process.env.TOOL_MODE_ONLY?[process.env.TOOL_MODE_ONLY]:['native','ptc']){
  const output=join(run,mode);await mkdir(join(output,'evidence'),{recursive:true});
  await writeFile(join(profile,'cordis.patch.yml'),`- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(documents)}\n- id: llm-pi-ai\n  config:\n    providers:\n      semantic-fixture:\n        api: openai-completions\n        apiKeyEnv: DSH_SEMANTIC_FIXTURE_KEY\n        baseURL: http://127.0.0.1:${fixturePort}/v1\n        models:\n          - id: semantic-fixture\n            name: Deterministic fixture (not a real model)\n            contextWindow: 32768\n            maxTokens: 4096\n- id: tools\n  config:\n    mode: ${mode}\n`);
  for(const phase of ['initial','cold','recovered']){
   const item=launch(mode+'-'+phase,['node_modules/@deepseek-ai/dsh/lib/bin.js','--profile','web','--patch',overlay,'--no-open','--port',String(port)]);activeHost=item.child;
   for(let i=0;i<300&&!/dsh web: http/.test(item.log);i++){if(item.child.exitCode!==null)break;await delay(100);}await writeFile(join(output,'dsh-host-'+phase+'.log'),item.log);if(!/dsh web: http/.test(item.log))throw Error('Owned host readiness failed: '+mode+' '+phase);
   const browser=launch(mode+'-'+phase+'-browser',['--import','tsx','tests/cold-source-browser.mjs'],{...env,HOST_OUTPUT:output,HOST_SHARED:run,TOOL_MODE:mode,COLD_PHASE:phase});browser.child.stdout.pipe(process.stdout);browser.child.stderr.pipe(process.stderr);const code=await new Promise(r=>browser.child.once('exit',r));await writeFile(join(output,'dsh-host-'+phase+'.log'),item.log);if(code!==0)throw Error('Cold browser lifecycle failed: '+mode+' '+phase);
   await stop(item.child);activeHost=undefined;
  }
 }
 if(process.env.INSTALL_PACKAGE){const installed=JSON.parse(await readFile(join(profile,'node_modules/@whytan/dsh-semantic-ui/package.json'),'utf8'));await writeFile(join(run,'install.json'),JSON.stringify({dsh:'0.2.1-rc.2',package:installed.name,version:installed.version,filename:basename(process.env.INSTALL_PACKAGE),sha256:createHash('sha256').update(await readFile(process.env.INSTALL_PACKAGE)).digest('hex'),allPackagedFilesVerified:filesVerified,verifiedBeforeStartingHost:true,installation:'actual dsh plugin --profile web add into fresh isolated profile; no semantic source overlay; separate read-only observer and synthetic activity fixture',toolModes:process.env.TOOL_MODE_ONLY?[process.env.TOOL_MODE_ONLY]:['native','ptc'],validationSuite:'cold-source-supplement',fullHostRestartsPerMode:2,newObservedModelTurns:0,fixtureOnly:true},null,2)+'\n');}
 console.log(JSON.stringify({coldSourceLifecycle:'passed',run:basename(run),fixtureOnly:true,newObservedModelTurns:0}));
}finally{
 await stop(activeHost);for(const{child}of [...children].reverse())await stop(child);for(const item of logs)await writeFile(join(run,item.kind+'.log'),item.log);
 await writeFile(join(run,'cleanup.json'),JSON.stringify({processes:children.map(({kind,child})=>({kind,pid:child.pid,exitCode:child.exitCode,signalCode:child.signalCode})),port,fixturePort},null,2)+'\n');
}

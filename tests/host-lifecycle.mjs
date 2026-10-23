import {spawn} from 'node:child_process';import{createServer}from'node:net';import{mkdir,writeFile,readFile}from'node:fs/promises';import path from'node:path';import{setTimeout as delay}from'node:timers/promises';
import{createHash}from'node:crypto';
const root=process.cwd();const run=path.join(root,'artifacts/local/host-'+Date.now());await mkdir(run,{recursive:true});
const freePort=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const fixturePort=await freePort();const port=await freePort();const home=path.join(run,'home');const profile=path.join(home,'profiles/web');await mkdir(profile,{recursive:true});await mkdir(path.join(run,'documents'),{recursive:true});
await writeFile(path.join(profile,'package.json'),JSON.stringify({name:'semantic-fixture-profile',private:true,dependencies:{},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}}));await writeFile(path.join(profile,'cordis.yml'),'[]\n');
const base=`- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(path.join(run,'documents'))}\n- id: llm-pi-ai\n  config:\n    providers:\n      semantic-fixture:\n        api: openai-completions\n        apiKeyEnv: DSH_SEMANTIC_FIXTURE_KEY\n        baseURL: http://127.0.0.1:${fixturePort}/v1\n        models:\n          - id: semantic-fixture\n            name: Deterministic fixture (not a real model)\n            contextWindow: 32768\n            maxTokens: 4096\n`;
const overlay=path.join(run,'plugin.patch.yml');await writeFile(overlay,process.env.INSTALL_PACKAGE?'[]\n':`- insert:\n    - id: dsh-semantic-ui\n      name: ${JSON.stringify(path.join(root,'dist/host.js'))}\n`);
const env={...process.env,DSH_HOME:home,DSH_SEMANTIC_FIXTURE_KEY:'local-fixture-placeholder',FIXTURE_OUTPUT_DIR:path.join(run,'requests'),FIXTURE_PORT:String(fixturePort),FIXTURE_DELAY_MS:'1500'};
if(process.env.INSTALL_PACKAGE){
 const installer=spawn(process.execPath,['node_modules/@deepseek-ai/dsh/lib/bin.js','plugin','--profile','web','add',path.resolve(process.env.INSTALL_PACKAGE)],{env,stdio:['ignore','pipe','pipe']});let installLog='';installer.stdout.on('data',b=>installLog+=b);installer.stderr.on('data',b=>installLog+=b);const code=await new Promise(r=>installer.once('exit',r));await writeFile(path.join(run,'install.log'),installLog);if(code!==0)throw Error('Release installation failed; inspect private run log.');
}
const fixture=spawn(process.execPath,['--import','tsx','tests/fixtures/llm-server.ts'],{env,stdio:['ignore','pipe','pipe']});let fixtureOutput='';fixture.stdout.on('data',b=>fixtureOutput+=b);fixture.stderr.on('data',b=>fixtureOutput+=b);
let host;
async function stop(child){if(!child||child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}
try{
 for(const mode of (process.env.TOOL_MODE_ONLY?[process.env.TOOL_MODE_ONLY]:['native','ptc'])){
  const output=path.join(run,mode);await mkdir(path.join(output,'evidence'),{recursive:true});await writeFile(path.join(profile,'cordis.patch.yml'),base+`- id: tools\n  config:\n    mode: ${mode}\n`);
  host=spawn(process.execPath,['node_modules/@deepseek-ai/dsh/lib/bin.js','--profile','web','--patch',overlay,'--no-open','--port',String(port)],{env,stdio:['ignore','pipe','pipe']});let log='';host.stdout.on('data',b=>log+=b);host.stderr.on('data',b=>log+=b);
  for(let i=0;i<300&&!/dsh web: http/.test(log);i++){if(host.exitCode!==null)throw Error('Isolated host failed to start; inspect private run log.');await delay(100);}
  await writeFile(path.join(output,'dsh-host.log'),log);if(!/dsh web: http/.test(log))throw Error('Host readiness timed out');
  for(const script of process.env.HISTORY_ONLY?['tests/host-browser.mjs']:['tests/host-browser.mjs','tests/templates-browser.mjs','tests/quality-browser.mjs']){
   const browser=spawn(process.execPath,[script],{env:{...env,HOST_ORIGIN:`http://127.0.0.1:${port}`,HOST_OUTPUT:output,HOST_SHARED:run,TOOL_MODE:mode},stdio:'inherit'});const code=await new Promise(r=>browser.once('exit',r));await writeFile(path.join(output,'dsh-host.log'),log);if(code!==0)throw Error(`Browser lifecycle failed: ${mode} ${script}`);
  }await stop(host);host=undefined;
 }
 if(process.env.INSTALL_PACKAGE){const installed=JSON.parse(await readFile(path.join(profile,'node_modules/@whytan/dsh-semantic-ui/package.json'),'utf8'));const result={dsh:'0.2.1-rc.2',installation:'actual dsh plugin --profile web add tgz into fresh isolated profile; no source overlay',package:installed.name,version:installed.version,filename:path.basename(process.env.INSTALL_PACKAGE),sha256:createHash('sha256').update(await readFile(process.env.INSTALL_PACKAGE)).digest('hex'),hostStarted:true,clientRenderedAllFourFixtures:true,toolModes:process.env.TOOL_MODE_ONLY?[process.env.TOOL_MODE_ONLY]:['native','ptc'],pageErrors:[]};await writeFile(path.join(run,'install.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
 console.log(`Real DSH fixture lifecycle passed for ${process.env.TOOL_MODE_ONLY??'native and ptc'}. Natural-question model acceptance is separate.`);
}finally{await stop(host);await stop(fixture);await writeFile(path.join(run,'fixture.log'),fixtureOutput);}

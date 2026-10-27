/** One new controlled source supplement, reusing an already accepted installation.
 * No package installation, old acceptance matrix, or real model in this host. */
import{spawn}from'node:child_process';
import{createServer}from'node:net';
import{readFileSync,writeFileSync,mkdirSync,realpathSync}from'node:fs';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import{setTimeout as delay}from'node:timers/promises';
const root=process.cwd(),output=resolve(process.env.ADOPTION_OUTPUT),accepted=resolve(process.env.ACCEPTED_HOST_RUN),scene=resolve(process.env.ADOPTION_SCENE);
mkdirSync(output,{recursive:true,mode:0o700});mkdirSync(output+'/evidence',{recursive:true});mkdirSync(output+'/requests',{recursive:true});
const profile=resolve(accepted,'home','profiles','web'),manifest=JSON.parse(readFileSync('artifacts/releases/0.1.0-preview.19/package-manifest.json'));
const installation=JSON.parse(readFileSync(accepted+'/install.json'));
if(!realpathSync(accepted).startsWith(root+'/artifacts/local/')||installation.sha256!==manifest.sha256||installation.version!==manifest.version||!installation.installation.includes('fresh isolated profile'))throw Error('Use only the accepted isolated fixture installation inside this repository');
const files={};for(const [name,sha]of Object.entries(manifest.runtimeEntrypoints)){const p=profile+'/node_modules/@whytan/dsh-semantic-ui/'+name;files[name]=createHash('sha256').update(readFileSync(p)).digest('hex');if(files[name]!==sha)throw Error('Previously installed runtime changed');}
writeFileSync(output+'/reused-install.json',JSON.stringify({version:manifest.version,sourceCommit:manifest.sourceCommit,archiveSha256:manifest.sha256,runtimeEntrypoints:files,installationRepeated:false},null,2));
if(process.env.VALIDATE_REUSED_INSTALL_ONLY==='1'){console.log('Accepted isolated installation identity verified; no host started or profile changed.');process.exit(0);}
const freePort=()=>new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const fixturePort=await freePort(),port=await freePort();if(port===3200||fixturePort===3200)throw Error('Shared port forbidden');
const patchPath=profile+'/cordis.patch.yml',oldPatch=readFileSync(patchPath,'utf8');
const patch=oldPatch.replace(/baseURL: http:\/\/127\.0\.0\.1:\d+\/v1/,'baseURL: http://127.0.0.1:'+fixturePort+'/v1').replace(/mode: (?:native|ptc)/,'mode: native');writeFileSync(patchPath,patch);
const env={...process.env,DSH_HOME:resolve(accepted,'home'),DSH_AGENTS_HOME:accepted+'/agents',DSH_SEMANTIC_FIXTURE_KEY:'local-fixture-placeholder',FIXTURE_OUTPUT_DIR:output+'/requests',FIXTURE_PORT:String(fixturePort),FIXTURE_DELAY_MS:'1200',SOURCE_HOST_CASE_FILE:output+'/source-case.json',ADOPTION_SCENE:scene,HOST_OUTPUT:output,HOST_SHARED:output,TOOL_MODE:'native'};
writeFileSync(env.SOURCE_HOST_CASE_FILE,JSON.stringify({key:'adoption-initial',args:{action:'source-check'}}));
const children=[];let fixtureLog='',hostLog='';
const launch=(kind,args)=>{const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});children.push({kind,child});return child;};
async function stop(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
try{
 const fixture=launch('fixture',['--import','tsx','tests/fixtures/llm-server.ts']);fixture.stdout.on('data',b=>fixtureLog+=b);fixture.stderr.on('data',b=>fixtureLog+=b);
 const host=launch('host',['node_modules/@deepseek-ai/dsh/lib/bin.js','--profile','web','--patch',accepted+'/plugin.patch.yml','--no-open','--port',String(port)]);host.stdout.on('data',b=>hostLog+=b);host.stderr.on('data',b=>hostLog+=b);
 for(let i=0;i<300&&!/dsh web: http/.test(hostLog);i++){if(host.exitCode!==null)throw Error('Owned host did not start');await delay(100);}writeFileSync(output+'/dsh-host.log',hostLog);if(!/dsh web: http/.test(hostLog))throw Error('Host readiness timeout');
 const browser=launch('browser',['--import','tsx','tests/source-update-adoption-browser.mjs']);browser.stdout.pipe(process.stdout);browser.stderr.pipe(process.stderr);const code=await new Promise(r=>browser.once('exit',r));if(code!==0)throw Error('New source adoption fixture failed');
}finally{
 for(const {child}of [...children].reverse())await stop(child);writeFileSync(patchPath,oldPatch);writeFileSync(output+'/dsh-host.log',hostLog);writeFileSync(output+'/fixture.log',fixtureLog);
 writeFileSync(output+'/cleanup.json',JSON.stringify({port,fixturePort,previousOwnedPatchRestored:readFileSync(patchPath,'utf8')===oldPatch,processes:children.map(({kind,child})=>({kind,pid:child.pid,exitCode:child.exitCode,signalCode:child.signalCode}))},null,2)+'\n');
}

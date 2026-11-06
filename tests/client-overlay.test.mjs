import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,linkSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {applyClientOverlay} from '../scripts/client-overlay.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'semantic-client-')),profile=join(root,'profile'),bundle=join(root,'bundle'),pkg=join(profile,'node_modules/@whytan/dsh-semantic-ui');mkdirSync(join(pkg,'dist'),{recursive:true});mkdirSync(bundle);writeFileSync(join(pkg,'package.json'),JSON.stringify({version:'0.1.0-preview.31'}));writeFileSync(join(profile,'cordis.yml'),'unchanged personal configuration');
 const baseRuntimeEntrypoints={};for(const name of ['host','core','mcp','protocol']){const text='base '+name;writeFileSync(join(pkg,'dist',name+'.js'),text);baseRuntimeEntrypoints['dist/'+name+'.js']=sha(text);}
 const baseClient={},files=[];for(const name of ['client.js','client.js.LEGAL.txt']){const old='old '+name,next='new '+name;writeFileSync(join(pkg,'dist',name),old);writeFileSync(join(bundle,name),next);baseClient[name]=sha(old);files.push({path:name,sha256:sha(next)});}
 writeFileSync(join(bundle,'client-manifest.json'),JSON.stringify({format:'dsh-semantic-ui-client-overlay',version:1,baseVersion:'0.1.0-preview.31',clientRevision:'0.1.0-preview.31-prose.1',baseRuntimeEntrypoints,baseClient,files}));return {root,profile,bundle,pkg};
}
test('atomic adoption breaks a client hardlink, preserves shared original/config and supports exact rollback',()=>{
 const f=fixture();try{const shared=join(f.root,'shared-original.js');linkSync(join(f.pkg,'dist/client.js'),shared);const adopted=applyClientOverlay(f.bundle,f.profile);assert.equal(adopted.healthyHostRestarted,false);assert.equal(readFileSync(shared,'utf8'),'old client.js');assert.equal(readFileSync(join(f.pkg,'dist/client.js'),'utf8'),'new client.js');assert.equal(applyClientOverlay(f.bundle,f.profile).changed,false);applyClientOverlay(f.bundle,f.profile,adopted.backupDirectory);assert.equal(readFileSync(join(f.pkg,'dist/client.js'),'utf8'),'old client.js');assert.equal(readFileSync(join(f.profile,'cordis.yml'),'utf8'),'unchanged personal configuration');}finally{rmSync(f.root,{recursive:true,force:true});}
});
test('refuses another installed revision before either client asset is changed',()=>{
 const f=fixture();try{writeFileSync(join(f.pkg,'dist/client.js'),'another owner revision');assert.throws(()=>applyClientOverlay(f.bundle,f.profile),/Installed client differs/);assert.equal(readFileSync(join(f.pkg,'dist/client.js.LEGAL.txt'),'utf8'),'old client.js.LEGAL.txt');}finally{rmSync(f.root,{recursive:true,force:true});}
});
test('refuses a package symlink escaping the explicit personal profile',()=>{
 const f=fixture();try{const foreign=join(f.root,'other-profile-package');mkdirSync(foreign);const profile=join(f.root,'symlink-profile');mkdirSync(join(profile,'node_modules/@whytan'),{recursive:true});symlinkSync(foreign,join(profile,'node_modules/@whytan/dsh-semantic-ui'));assert.throws(()=>applyClientOverlay(f.bundle,profile),/physically inside/);}finally{rmSync(f.root,{recursive:true,force:true});}
});
test('upgrades an approved previous client and rolls back to that exact revision rather than the original base',()=>{
 const f=fixture();try{const path=join(f.bundle,'client-manifest.json'),m=JSON.parse(readFileSync(path)),files={};for(const name of ['client.js','client.js.LEGAL.txt']){const bytes='previous overlay '+name;writeFileSync(join(f.pkg,'dist',name),bytes);files[name]=sha(bytes);}m.previousClients=[{clientRevision:'previous',files}];writeFileSync(path,JSON.stringify(m));const r=applyClientOverlay(f.bundle,f.profile);applyClientOverlay(f.bundle,f.profile,r.backupDirectory);assert.equal(readFileSync(join(f.pkg,'dist/client.js'),'utf8'),'previous overlay client.js');}finally{rmSync(f.root,{recursive:true,force:true});}
});
test('accepts an explicitly approved complete host variant and refuses an unknown runtime without changing assets',()=>{
 const f=fixture();try{
  const path=join(f.bundle,'client-manifest.json'),m=JSON.parse(readFileSync(path)),host='approved existing host overlay';
  m.runtimeVariants=[{name:'existing-host-overlay',entrypoints:{...m.baseRuntimeEntrypoints,'dist/host.js':sha(host)}}];writeFileSync(path,JSON.stringify(m));writeFileSync(join(f.pkg,'dist/host.js'),host);
  const r=applyClientOverlay(f.bundle,f.profile);assert.equal(readFileSync(join(f.pkg,'dist/host.js'),'utf8'),host);applyClientOverlay(f.bundle,f.profile,r.backupDirectory);
  writeFileSync(join(f.pkg,'dist/core.js'),'unknown core');assert.throws(()=>applyClientOverlay(f.bundle,f.profile),/approved complete runtime/);assert.equal(readFileSync(join(f.pkg,'dist/client.js'),'utf8'),'old client.js');
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
